import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ApiResponse } from '../types';
import { buildStoreWhereClause } from '../utils/storeFilter';

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
      const storeFilter = storeScope
        ? `AND b.store_id IN (${(req.accessibleStoreIds as number[]).map((id) => Number(id)).join(',')})`
        : '';

      const crossTabRows = await prisma.$queryRawUnsafe<
        { store_number: string; store_name: string; type_code: string | null; type_name: string | null; doc_count: bigint }[]
      >(`
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
        WHERE 1=1 ${storeFilter}
        GROUP BY s.store_number, s.name, dt.code, dt.name
        ORDER BY s.store_number, dt.code
      `);

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

export default router;
