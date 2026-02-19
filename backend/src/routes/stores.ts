import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { ApiResponse } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { requireMinimumRole } from '../middleware/authorize';

const router = Router();

const createSchema = z.object({
  storeNumber: z.string().min(1).max(20),
  name: z.string().max(100).optional(),
});

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { store_number: 'asc' },
      include: {
        _count: { select: { batches: true } },
      },
    });

    const response: ApiResponse = { success: true, data: stores };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireMinimumRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message);
    }

    const { storeNumber, name } = parsed.data;

    const existing = await prisma.store.findUnique({
      where: { store_number: storeNumber },
    });

    if (existing) {
      throw new BadRequestError(`Store ${storeNumber} already exists`);
    }

    const store = await prisma.store.create({
      data: {
        store_number: storeNumber,
        name: name ?? `Store ${storeNumber}`,
      },
    });

    logger.info(`Created store: ${storeNumber}`);
    const response: ApiResponse = { success: true, data: store };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

const updateSchema = z.object({
  name: z.string().max(100).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
});

router.patch('/:id', requireMinimumRole('manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10);
    if (isNaN(id)) {
      throw new BadRequestError('Invalid store ID');
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid request');
    }

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) {
      throw new NotFoundError('Store not found');
    }

    const updated = await prisma.store.update({
      where: { id },
      data: parsed.data,
    });

    logger.info(`Updated store ${store.store_number}: ${JSON.stringify(parsed.data)}`);
    const response: ApiResponse = { success: true, data: updated };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
