import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { ApiResponse, CursorPaginatedResponse } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { processTiffScan } from '../services/batchProcessor';
import { logger } from '../utils/logger';
import { requireMinimumRole, requireRole } from '../middleware/authorize';
import { buildStoreWhereClause } from '../utils/storeFilter';
import {
  cursorPaginationSchema,
  buildCursorWhere,
  extractNextCursor,
} from '../utils/pagination';

const router = Router();

function serializeBatch(batch: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(batch, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}

const querySchema = z.object({
  storeNumber: z.string().optional(),
  status: z.string().optional(),
  parentOnly: z.string().optional(),
}).merge(cursorPaginationSchema);

const updateBatchSchema = z.object({
  storeId: z.number().int().positive(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Invalid query parameters');
    }

    const { storeNumber, status, parentOnly, cursor, limit } = parsed.data;
    const storeScope = buildStoreWhereClause(req.accessibleStoreIds);

    const baseWhere = {
      ...storeScope,
      store: storeNumber ? { store_number: storeNumber } : undefined,
      status: status ?? undefined,
      parent_batch_id: parentOnly === 'true' ? null : undefined,
    };
    const cursorWhere = { ...baseWhere, ...buildCursorWhere(cursor) };

    const [batches, totalCount] = await Promise.all([
      prisma.batch.findMany({
        where: cursorWhere,
        include: {
          store: true,
          _count: { select: { documents: true, childBatches: true } },
        },
        orderBy: { id: 'desc' },
        take: limit,
      }),
      prisma.batch.count({ where: baseWhere }),
    ]);

    const serialized = batches.map((b) => serializeBatch(b as Record<string, unknown>));
    const nextCursor = extractNextCursor(batches, limit);
    const response: CursorPaginatedResponse = {
      success: true,
      data: serialized,
      nextCursor,
      totalCount,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10);
    if (isNaN(id)) {
      throw new BadRequestError('Invalid batch ID');
    }

    const storeScope = buildStoreWhereClause(req.accessibleStoreIds);

    const batch = await prisma.batch.findFirst({
      where: { id, ...storeScope },
      include: {
        store: true,
        parentBatch: {
          select: { id: true, reference: true, batch_type: true },
        },
        childBatches: {
          select: {
            id: true,
            reference: true,
            batch_type: true,
            status: true,
            page_count: true,
          },
          orderBy: { id: 'asc' },
        },
        documents: {
          include: {
            documentType: true,
            pageExtractions: {
              orderBy: { page_number: 'asc' },
              take: 1,
            },
          },
          orderBy: { page_number: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const response: ApiResponse = {
      success: true,
      data: serializeBatch(batch as Record<string, unknown>),
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:id',
  requireMinimumRole('manager'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params['id'] ?? '', 10);
      if (isNaN(id)) {
        throw new BadRequestError('Invalid batch ID');
      }

      const parsed = updateBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid request');
      }

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) {
        throw new NotFoundError('Batch not found');
      }

      const store = await prisma.store.findUnique({
        where: { id: parsed.data.storeId },
      });
      if (!store) {
        throw new NotFoundError('Store not found');
      }

      const updated = await prisma.batch.update({
        where: { id },
        data: { store_id: parsed.data.storeId },
        include: {
          store: true,
          _count: { select: { documents: true } },
        },
      });

      logger.info(`Batch ${id} store changed to ${store.store_number}`);
      const response: ApiResponse = {
        success: true,
        data: serializeBatch(updated as Record<string, unknown>),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/reprocess',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params['id'] ?? '', 10);
      if (isNaN(id)) {
        throw new BadRequestError('Invalid batch ID');
      }

      const batch = await prisma.batch.findUnique({ where: { id } });
      if (!batch) {
        throw new NotFoundError('Batch not found');
      }

      if (batch.status !== 'failed') {
        throw new BadRequestError('Can only reprocess failed batches');
      }

      await prisma.$transaction(async (tx) => {
        const childBatches = await tx.batch.findMany({
          where: { parent_batch_id: id },
          select: { id: true },
        });
        const childIds = childBatches.map((b) => b.id);

        if (childIds.length > 0) {
          await tx.document.deleteMany({
            where: { batch_id: { in: childIds } },
          });
          await tx.batch.deleteMany({
            where: { id: { in: childIds } },
          });
        }

        await tx.document.deleteMany({ where: { batch_id: id } });

        await tx.batch.update({
          where: { id },
          data: { status: 'pending', error_message: null, batch_type: null },
        });
      });

      logger.info(`Reprocessing batch ${id}`);

      setImmediate(() => {
        processTiffScan(id).catch((err) => {
          logger.error(`Reprocess failed for batch ${id}:`, err);
        });
      });

      const response: ApiResponse = {
        success: true,
        message: 'Batch queued for reprocessing',
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
