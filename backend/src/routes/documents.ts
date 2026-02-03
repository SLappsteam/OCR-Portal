import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ApiResponse } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

function serializeDocument(doc: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(doc, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}

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
          select: {
            id: true,
            reference: true,
            batch_type: true,
            parent_batch_id: true,
            parentBatch: {
              select: { id: true, reference: true, page_count: true },
            },
            store: true,
          },
        },
        documentType: true,
        pageExtractions: {
          orderBy: { page_number: 'asc' },
          take: 1,
          select: { fields: true, confidence: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const serialized = documents.map((d) => {
      const raw = serializeDocument(d as unknown as Record<string, unknown>);
      const extractions = raw['pageExtractions'] as { fields: unknown; confidence: number }[] | undefined;
      raw['extraction_fields'] = extractions?.[0]?.fields ?? null;
      raw['confidence'] = extractions?.[0]?.confidence ?? null;
      delete raw['pageExtractions'];
      // Add root_batch_id for navigation to original batch with all pages
      const batch = raw['batch'] as { id: number; parent_batch_id?: number | null; parentBatch?: { id: number } | null };
      raw['root_batch_id'] = batch.parentBatch?.id ?? batch.id;
      return raw;
    });
    const response: ApiResponse = { success: true, data: serialized };
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
        batch: {
          select: {
            id: true,
            reference: true,
            batch_type: true,
            file_name: true,
            store: true,
          },
        },
        documentType: true,
      },
    });

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const response: ApiResponse = {
      success: true,
      data: serializeDocument(document as unknown as Record<string, unknown>),
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/extractions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params['id'] ?? '', 10);
    if (isNaN(id)) {
      throw new BadRequestError('Invalid document ID');
    }

    const extractions = await prisma.pageExtraction.findMany({
      where: { document_id: id },
      orderBy: { page_number: 'asc' },
    });

    const response: ApiResponse = { success: true, data: extractions };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

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
      const response: ApiResponse = {
        success: true,
        data: serializeDocument(updated as unknown as Record<string, unknown>),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
