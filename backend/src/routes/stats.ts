import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiResponse } from '../types';
import { buildStoreWhereClause } from '../utils/storeFilter';
import { BadRequestError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

interface DocumentTypeInfo {
  code: string;
  name: string;
}

interface StoreTypeRow {
  storeNumber: string;
  storeName: string;
  types: Record<string, number>;
  total: number;
}

interface DashboardStats {
  totalDocuments: number;
  totalBatches: number;
  documentsByType: { type: string; count: number }[];
  documentsByStore: { store: string; count: number }[];
  batchesByStatus: { status: string; count: number }[];
  recentActivity: {
    id: number;
    fileName: string;
    store: string;
    status: string;
    createdAt: Date;
  }[];
  documentsByStoreAndType: StoreTypeRow[];
  activeDocumentTypes: DocumentTypeInfo[];
}

router.get(
  '/dashboard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storeScope = buildStoreWhereClause(req.accessibleStoreIds);
      const batchFilter = storeScope ? { batch: storeScope } : {};

      const [
        totalDocuments,
        totalBatches,
        documentsByType,
        documentsByStore,
        batchesByStatus,
        recentBatches,
      ] = await Promise.all([
        prisma.document.count({ where: batchFilter }),
        prisma.batch.count({ where: storeScope }),
        prisma.document.groupBy({
          by: ['document_type_id'],
          where: batchFilter,
          _count: { id: true },
        }),
        prisma.document.groupBy({
          by: ['batch_id'],
          where: batchFilter,
          _count: { id: true },
        }),
        prisma.batch.groupBy({
          by: ['status'],
          where: storeScope,
          _count: { id: true },
        }),
        prisma.batch.findMany({
          where: storeScope,
          take: 10,
          orderBy: { created_at: 'desc' },
          include: { store: true },
        }),
      ]);

      const docTypes = await prisma.documentType.findMany();
      const docTypeMap = new Map(docTypes.map((dt) => [dt.id, dt.name]));

      const batchStores = await prisma.batch.findMany({
        select: { id: true, store: { select: { store_number: true } } },
      });
      const batchStoreMap = new Map(
        batchStores.map((b) => [b.id, b.store.store_number])
      );

      const storeDocCounts = new Map<string, number>();
      for (const item of documentsByStore) {
        const storeNum = batchStoreMap.get(item.batch_id) ?? 'Unknown';
        const current = storeDocCounts.get(storeNum) ?? 0;
        storeDocCounts.set(storeNum, current + item._count.id);
      }

      // Cross-tab query: document counts grouped by store AND document type
      const storeFilterSql = storeScope
        ? Prisma.sql`AND b.store_id IN (${Prisma.join(req.accessibleStoreIds as number[])})`
        : Prisma.empty;

      const crossTabRows = await prisma.$queryRaw<
        { store_number: string; store_name: string; type_code: string | null; type_name: string | null; doc_count: bigint }[]
      >`
        SELECT
          s.store_number,
          s.name AS store_name,
          dt.code AS type_code,
          dt.name AS type_name,
          COUNT(d.id)::bigint AS doc_count
        FROM documents d
        INNER JOIN batches b ON d.batch_id = b.id
        INNER JOIN stores s ON b.store_id = s.id
        LEFT JOIN document_types dt ON d.document_type_id = dt.id
        WHERE 1=1 ${storeFilterSql}
        GROUP BY s.store_number, s.name, dt.code, dt.name
        ORDER BY s.store_number, dt.code
      `;

      // Post-process flat rows into nested StoreTypeRow[] shape
      const storeTypeMap = new Map<string, StoreTypeRow>();
      const activeTypeSet = new Map<string, string>();

      for (const row of crossTabRows) {
        const key = row.store_number;
        if (!storeTypeMap.has(key)) {
          storeTypeMap.set(key, {
            storeNumber: row.store_number,
            storeName: row.store_name,
            types: {},
            total: 0,
          });
        }
        const entry = storeTypeMap.get(key)!;
        const typeCode = row.type_code ?? 'unclassified';
        const typeName = row.type_name ?? 'Unclassified';
        const count = Number(row.doc_count);
        entry.types[typeCode] = (entry.types[typeCode] ?? 0) + count;
        entry.total += count;

        if (count > 0) {
          activeTypeSet.set(typeCode, typeName);
        }
      }

      const documentsByStoreAndType = Array.from(storeTypeMap.values()).sort(
        (a, b) => a.storeNumber.localeCompare(b.storeNumber, undefined, { numeric: true })
      );

      const activeDocumentTypes: DocumentTypeInfo[] = Array.from(activeTypeSet.entries())
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.code.localeCompare(b.code));

      const stats: DashboardStats = {
        totalDocuments,
        totalBatches,
        documentsByType: documentsByType.map((item) => ({
          type: docTypeMap.get(item.document_type_id ?? 0) ?? 'Unclassified',
          count: item._count.id,
        })),
        documentsByStore: Array.from(storeDocCounts.entries()).map(
          ([store, count]) => ({ store, count })
        ),
        batchesByStatus: batchesByStatus.map((item) => ({
          status: item.status,
          count: item._count.id,
        })),
        recentActivity: recentBatches.map((batch) => ({
          id: batch.id,
          fileName: batch.file_name,
          store: batch.store.store_number,
          status: batch.status,
          createdAt: batch.created_at,
        })),
        documentsByStoreAndType,
        activeDocumentTypes,
      };

      const response: ApiResponse<DashboardStats> = {
        success: true,
        data: stats,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// --- Daily Scorecard ---

interface ScorecardRow {
  storeNumber: string;
  storeName: string;
  batchCount: number;
  pageCount: number;
  classifiedCount: number;
  unknownCount: number;
  missingCoversheetCount: number;
  hasFailedBatches: boolean;
  status: 'green' | 'yellow' | 'red';
}

interface DailyScorecardResponse {
  date: string;
  batchesToday: number;
  pagesToday: number;
  issueCount: number;
  activeStoreCount: number;
  batchesByStatus: { status: string; count: number }[];
  scorecardRows: ScorecardRow[];
  recentBatches: {
    id: number;
    fileName: string;
    store: string;
    status: string;
    createdAt: Date;
  }[];
}

const scorecardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

function buildDateRange(dateStr: string): { start: Date; end: Date } {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function fetchScorecardAggregates(
  start: Date,
  end: Date,
  storeFilterSql: Prisma.Sql
) {
  return prisma.$queryRaw<
    {
      store_number: string;
      store_name: string;
      batch_count: bigint;
      page_count: bigint;
      classified_count: bigint;
      unknown_count: bigint;
      has_failed_batches: boolean;
    }[]
  >`
    SELECT s.store_number, s.name AS store_name,
      COUNT(DISTINCT b.id) AS batch_count,
      COALESCE((SELECT SUM(b2.page_count) FROM batches b2 WHERE b2.store_id = s.id AND b2.created_at >= ${start} AND b2.created_at < ${end}), 0) AS page_count,
      COUNT(d.id) FILTER (WHERE dt.code IS NOT NULL AND dt.code != 'UNKNOWN') AS classified_count,
      COUNT(d.id) FILTER (WHERE dt.code = 'UNKNOWN' OR dt.code IS NULL) AS unknown_count,
      BOOL_OR(b.status = 'failed') AS has_failed_batches
    FROM batches b
    INNER JOIN stores s ON b.store_id = s.id
    LEFT JOIN documents d ON d.batch_id = b.id
    LEFT JOIN document_types dt ON d.document_type_id = dt.id
    WHERE b.created_at >= ${start} AND b.created_at < ${end} ${storeFilterSql}
    GROUP BY s.store_number, s.name, s.id
    ORDER BY s.store_number
  `;
}

async function fetchMissingCoversheetCounts(
  start: Date,
  end: Date,
  storeFilterSql: Prisma.Sql
) {
  const rows = await prisma.$queryRaw<
    { store_number: string; missing_count: bigint }[]
  >`
    SELECT s.store_number, COUNT(DISTINCT b.id) AS missing_count
    FROM batches b
    INNER JOIN stores s ON b.store_id = s.id
    INNER JOIN documents d ON d.batch_id = b.id
    WHERE b.created_at >= ${start} AND b.created_at < ${end} ${storeFilterSql}
      AND d.page_number = (SELECT MIN(d2.page_number) FROM documents d2 WHERE d2.batch_id = b.id)
      AND d.is_coversheet = false
    GROUP BY s.store_number
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.store_number, Number(row.missing_count));
  }
  return map;
}

router.get(
  '/daily-scorecard',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = scorecardQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid date');
      }

      const { date } = parsed.data;
      const { start, end } = buildDateRange(date);
      const storeScope = buildStoreWhereClause(req.accessibleStoreIds);

      const storeFilterSql = storeScope
        ? Prisma.sql`AND b.store_id IN (${Prisma.join(req.accessibleStoreIds as number[])})`
        : Prisma.empty;

      const [aggregates, missingMap, batchStatuses, recentBatches] =
        await Promise.all([
          fetchScorecardAggregates(start, end, storeFilterSql),
          fetchMissingCoversheetCounts(start, end, storeFilterSql),
          prisma.batch.groupBy({
            by: ['status'],
            where: {
              ...storeScope,
              created_at: { gte: start, lt: end },
            },
            _count: { id: true },
          }),
          prisma.batch.findMany({
            where: {
              ...storeScope,
              created_at: { gte: start, lt: end },
            },
            take: 10,
            orderBy: { created_at: 'desc' },
            include: { store: true },
          }),
        ]);

      const scorecardRows: ScorecardRow[] = aggregates.map((row) => {
        const missingCoversheetCount = missingMap.get(row.store_number) ?? 0;
        const hasFailedBatches = row.has_failed_batches;
        const unknownCount = Number(row.unknown_count);

        let status: 'green' | 'yellow' | 'red' = 'green';
        if (hasFailedBatches || missingCoversheetCount > 0) {
          status = 'red';
        } else if (unknownCount > 0) {
          status = 'yellow';
        }

        return {
          storeNumber: row.store_number,
          storeName: row.store_name,
          batchCount: Number(row.batch_count),
          pageCount: Number(row.page_count),
          classifiedCount: Number(row.classified_count),
          unknownCount,
          missingCoversheetCount,
          hasFailedBatches,
          status,
        };
      });

      const batchesToday = scorecardRows.reduce((s, r) => s + r.batchCount, 0);
      const pagesToday = scorecardRows.reduce((s, r) => s + r.pageCount, 0);
      const issueCount = scorecardRows.filter((r) => r.status === 'red').length;

      const result: DailyScorecardResponse = {
        date,
        batchesToday,
        pagesToday,
        issueCount,
        activeStoreCount: scorecardRows.length,
        batchesByStatus: batchStatuses.map((item) => ({
          status: item.status,
          count: item._count.id,
        })),
        scorecardRows,
        recentBatches: recentBatches.map((b) => ({
          id: b.id,
          fileName: b.file_name,
          store: b.store.store_number,
          status: b.status,
          createdAt: b.created_at,
        })),
      };

      logger.debug(`Daily scorecard fetched for ${date}`);
      const response: ApiResponse<DailyScorecardResponse> = {
        success: true,
        data: result,
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
