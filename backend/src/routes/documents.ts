import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { ApiResponse, OffsetPaginatedResponse } from '../types';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { requireMinimumRole } from '../middleware/authorize';
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
  documentType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  excludeCoversheets: z.string().optional(),
}).merge(offsetPaginationSchema);

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

    const { storeNumber, documentType, startDate, endDate, excludeCoversheets, page, limit } = parsed.data;
    const storeScope = buildStoreWhereClause(req.accessibleStoreIds);

    const where = {
      batch: {
        ...storeScope,
        ...(storeNumber ? { store: { store_number: storeNumber } } : {}),
      },
      documentType: documentType ? { code: documentType } : undefined,
      is_coversheet: excludeCoversheets === 'true' ? false : undefined,
      created_at: {
        gte: startDate ? new Date(startDate) : undefined,
        lte: endDate ? new Date(endDate) : undefined,
      },
    };

    const [documents, totalCount] = await Promise.all([
      prisma.document.findMany({
        where,
        include: {
          batch: {
            select: {
              id: true,
              reference: true,
              batch_type: true,
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
        orderBy: { id: 'desc' },
        skip: calculateSkip(page, limit),
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    const serialized = documents.map((d) => {
      const raw = serializeBigIntFields(d as unknown as Record<string, unknown>);
      const extractions = raw['pageExtractions'] as { fields: unknown; confidence: number }[] | undefined;
      raw['extraction_fields'] = extractions?.[0]?.fields ?? null;
      raw['confidence'] = extractions?.[0]?.confidence ?? null;
      delete raw['pageExtractions'];
      return raw;
    });
    const response: OffsetPaginatedResponse = {
      success: true,
      data: serialized,
      page,
      limit,
      totalCount,
      totalPages: calculateTotalPages(totalCount, limit),
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
      throw new BadRequestError('Invalid document ID');
    }

    const storeScope = buildStoreWhereClause(req.accessibleStoreIds);

    const document = await prisma.document.findFirst({
      where: {
        id,
        batch: storeScope ? { ...storeScope } : undefined,
      },
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
      data: serializeBigIntFields(document as unknown as Record<string, unknown>),
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
  requireMinimumRole('operator'),
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
        data: serializeBigIntFields(updated as unknown as Record<string, unknown>),
      };
      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
