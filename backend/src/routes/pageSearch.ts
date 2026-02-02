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
  filters: z.union([z.string(), z.array(z.string())]).optional(),
});

const ALLOWED_FILTER_FIELDS = new Set([
  'customer_name', 'customer_id', 'order_id', 'phone',
  'order_type', 'salesperson', 'stat', 'zone',
  'customer_code',
]);

function parseFieldFilters(raw: string | string[] | undefined) {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .map((s) => {
      const idx = s.indexOf(':');
      if (idx < 1) return null;
      const field = s.slice(0, idx);
      const value = s.slice(idx + 1);
      if (!ALLOWED_FILTER_FIELDS.has(field) || !value) return null;
      return { path: [field], string_contains: value };
    })
    .filter(Boolean) as { path: string[]; string_contains: string }[];
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new BadRequestError('search parameter is required');
    }

    const { search, storeNumber, documentType, filters: rawFilters } = parsed.data;

    const searchFields = [
      'customer_name', 'order_id', 'customer_id', 'phone',
      'order_type', 'salesperson', 'stat', 'zone',
      'customer_code',
    ];
    const jsonOrFilters = searchFields.map((field) => ({
      fields: { path: [field], string_contains: search },
    }));

    const fieldFilters = parseFieldFilters(rawFilters);
    const fieldAndConditions = fieldFilters.map((f) => ({ fields: f }));

    const extractions = await prisma.pageExtraction.findMany({
      where: {
        OR: jsonOrFilters,
        ...(fieldAndConditions.length > 0 ? { AND: fieldAndConditions } : {}),
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
