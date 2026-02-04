import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getTiffMetadata, extractPageAsPng } from '../services/tiffService';
import { detectBarcode, normalizeBarcode } from '../services/barcodeService';
import { analyzeTiff } from '../services/documentSplitter';
import { processTiffScan, getBatchStatus } from '../services/batchProcessor';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { BadRequestError } from '../middleware/errorHandler';

const router = Router();

const analyzeSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
});

const processBatchSchema = z.object({
  batchId: z.number().int().positive('Batch ID must be positive'),
});

router.post(
  '/analyze-tiff',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = analyzeSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message);
      }

      const { filePath } = parsed.data;
      logger.info(`Test: Analyzing TIFF at ${filePath}`);

      const metadata = await getTiffMetadata(filePath);
      const boundaries = await analyzeTiff(filePath);

      const response: ApiResponse = {
        success: true,
        data: {
          metadata,
          documents: boundaries,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/process-batch',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = processBatchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message);
      }

      const { batchId } = parsed.data;
      logger.info(`Test: Processing batch ${batchId}`);

      await processTiffScan(batchId);
      const status = await getBatchStatus(batchId);

      const response: ApiResponse = {
        success: true,
        data: status,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/scan-page',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        filePath: z.string().min(1),
        pageNumber: z.number().int().min(0),
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        throw new BadRequestError(parsed.error.errors[0]?.message);
      }

      const { filePath, pageNumber } = parsed.data;
      const pageBuffer = await extractPageAsPng(filePath, pageNumber);
      const rawBarcode = await detectBarcode(pageBuffer);

      const response: ApiResponse = {
        success: true,
        data: {
          pageNumber,
          barcodeRaw: rawBarcode,
          barcodeNormalized: rawBarcode ? normalizeBarcode(rawBarcode) : null,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
