import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ApiResponse } from '../types';
import { BadRequestError } from '../middleware/errorHandler';

const router = Router();
const prisma = new PrismaClient();

const querySchema = z.object({
  search: z.string().min(1),
  storeNumber: z.string().optional(),
  documentType: z.string().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('search parameter is required');
    }

    const { search, storeNumber, documentType } = parsed.data;

    const searchFields = ['customer_name', 'order_id', 'customer_id', 'phone'];
    const jsonOrFilters = searchFields.map((field) => ({
      fields: { path: [field], string_contains: search },
    }));

    const extractions = await prisma.pageExtraction.findMany({
      where: {
        OR: jsonOrFilters,
        document: {
          batch: storeNumber
            ? { store: { store_number: storeNumber } }
            : undefined,
          documentType: documentType ? { code: documentType } : undefined,
        },
      },
      include: {
        document: {
          include: {
            batch: { include: { store: true } },
            documentType: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    const results = extractions.map((ext) => ({
      document_id: ext.document_id,
      page_number: ext.page_number,
      fields: ext.fields,
      confidence: ext.confidence,
      document_reference: ext.document.reference,
      document_type_code: ext.document.documentType?.code ?? null,
      document_type_name: ext.document.documentType?.name ?? null,
      store_number: ext.document.batch.store.store_number,
      created_at: ext.created_at,
    }));

    const response: ApiResponse = { success: true, data: results };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
