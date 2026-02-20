import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { ApiResponse, OffsetPaginatedResponse } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { processTiffScan } from '../services/batchProcessor';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { requireMinimumRole, requireRole } from '../middleware/authorize';
import { buildStoreWhereClause } from '../utils/storeFilter';
import { serializeBigIntFields } from '../utils/serialize';
import {
  offsetPaginationSchema,
  calculateSkip,
  calculateTotalPages,
} from '../utils/pagination';

const router = Router();

const querySchema = z.object({
  storeNumber: z.string().optional(),
  status: z.string().optional(),
  batchType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  parentOnly: z.string().optional(),
  issues: z.string().optional(),
}).merge(offsetPaginationSchema);

const updateBatchSchema = z.object({
  storeId: z.number().int().positive(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Invalid query parameters');
    }

    const { storeNumber, status, batchType, startDate, endDate, search, parentOnly, issues, page, limit } = parsed.data;
    const storeScope = buildStoreWhereClause(req.accessibleStoreIds);

    // Issues mode: OR across unclassified type, failed status, and unassigned store
    if (issues === 'true') {
      const where: Record<string, unknown> = {
        ...storeScope,
        OR: [
          { batch_type: 'UNCLASSIFIED' },
          { status: 'failed' },
          { store: { store_number: 'UNASSIGNED' } },
        ],
      };

      const [batches, totalCount] = await Promise.all([
        prisma.batch.findMany({
          where,
          include: {
            store: true,
            _count: { select: { documents: true, childBatches: true } },
          },
          orderBy: { id: 'desc' },
          skip: calculateSkip(page, limit),
          take: limit,
        }),
        prisma.batch.count({ where }),
      ]);

      const serialized = batches.map((b) => serializeBigIntFields(b as Record<string, unknown>));
      const response: OffsetPaginatedResponse = {
        success: true,
        data: serialized,
        page,
        limit,
        totalCount,
        totalPages: calculateTotalPages(totalCount, limit),
      };
      return res.json(response);
    }

    const where: Record<string, unknown> = {
      ...storeScope,
      store: storeNumber ? { store_number: storeNumber } : undefined,
      status: status || undefined,
      batch_type: batchType || undefined,
      parent_batch_id: parentOnly === 'true' ? null : undefined,
      ...(startDate || endDate
        ? {
            created_at: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate + 'T23:59:59.999Z') } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { file_name: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { batch_type: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [batches, totalCount] = await Promise.all([
      prisma.batch.findMany({
        where,
        include: {
          store: true,
          _count: { select: { documents: true, childBatches: true } },
        },
        orderBy: { id: 'desc' },
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.batch.count({ where }),
    ]);

    const serialized = batches.map((b) => serializeBigIntFields(b as Record<string, unknown>));
    const response: OffsetPaginatedResponse = {
      success: true,
      data: serialized,
      page,
      limit,
      totalCount,
      totalPages: calculateTotalPages(totalCount, limit),
    };
    return res.json(response);
  } catch (error) {
    return next(error);
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
      data: serializeBigIntFields(batch as Record<string, unknown>),
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
        data: serializeBigIntFields(updated as Record<string, unknown>),
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
      void logAuditEvent({
        userId: req.user!.userId,
        userEmail: req.user!.email,
        action: 'batch.reprocess',
        resourceType: 'batch',
        resourceId: String(id),
        ipAddress: req.ip,
      });

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
