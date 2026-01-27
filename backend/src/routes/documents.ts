import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ApiResponse } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const querySchema = z.object({
  storeNumber: z.string().optional(),
  documentType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const updateSchema = z.object({
  storeId: z.number().int().positive().optional(),
  documentTypeId: z.number().int().positive().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('Invalid query parameters');
    }

    const { storeNumber, documentType, startDate, endDate } = parsed.data;

    const documents = await prisma.document.findMany({
      where: {
        batch: storeNumber
          ? { store: { store_number: storeNumber } }
          : undefined,
        documentType: documentType ? { code: documentType } : undefined,
        created_at: {
          gte: startDate ? new Date(startDate) : undefined,
          lte: endDate ? new Date(endDate) : undefined,
        },
      },
      include: {
        batch: {
          include: { store: true },
        },
        documentType: true,
      },
      orderBy: { created_at: 'desc' },
    });

    const response: ApiResponse = { success: true, data: documents };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10);
    if (isNaN(id)) {
      throw new BadRequestError('Invalid document ID');
    }

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        batch: { include: { store: true } },
        documentType: true,
      },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const response: ApiResponse = { success: true, data: document };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// TODO: Add auth middleware - admin only
router.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = parseInt(req.params['id'] ?? '', 10);
      if (isNaN(id)) {
        throw new BadRequestError('Invalid document ID');
      }

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message);
      }

      const existing = await prisma.document.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError('Document not found');
      }

      const updated = await prisma.document.update({
        where: { id },
        data: {
          document_type_id: parsed.data.documentTypeId,
        },
        include: {
          batch: { include: { store: true } },
          documentType: true,
        },
      });

      logger.info(`Document ${id} updated`);
      const response: ApiResponse = { success: true, data: updated };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
