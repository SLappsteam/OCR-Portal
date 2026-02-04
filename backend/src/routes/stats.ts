import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ApiResponse } from '../types';
import { buildStoreWhereClause } from '../utils/storeFilter';

const router = Router();

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
