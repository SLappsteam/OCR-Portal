import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import sharp from 'sharp';
import { extractPageAsPng } from '../services/tiffService';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { buildStoreWhereClause } from '../utils/storeFilter';

const router = Router();

const THUMBNAIL_WIDTH = 300;
const CACHE_MAX_AGE = 300;

async function getDocumentWithBatch(
  documentId: number,
  storeIds: number[] | null | undefined
) {
  const storeScope = buildStoreWhereClause(storeIds);

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      batch: storeScope ? { ...storeScope } : undefined,
    },
    include: { batch: true },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  return document;
}

router.get(
  '/batch/:batchId/:pageNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchId = parseInt(req.params['batchId'] ?? '', 10);
      const pageNumber = parseInt(req.params['pageNumber'] ?? '', 10);

      if (isNaN(batchId) || isNaN(pageNumber) || pageNumber < 0) {
        throw new BadRequestError('Invalid batch ID or page number');
      }

      const storeScope = buildStoreWhereClause(req.accessibleStoreIds);

      const batch = await prisma.batch.findFirst({
        where: { id: batchId, ...storeScope },
      });
      if (!batch) {
        throw new NotFoundError('Batch not found');
      }

      if (batch.page_count !== null && pageNumber >= batch.page_count) {
        throw new BadRequestError(`Page ${pageNumber} exceeds batch page count (${batch.page_count})`);
      }

      const imageBuffer = await extractPageAsPng(batch.file_path, pageNumber);

      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': `private, max-age=${CACHE_MAX_AGE}`,
      });
      res.send(imageBuffer);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:documentId/:pageNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = parseInt(req.params['documentId'] ?? '', 10);
      const pageNumber = parseInt(req.params['pageNumber'] ?? '', 10);

      if (isNaN(documentId) || isNaN(pageNumber) || pageNumber < 0) {
        throw new BadRequestError('Invalid document ID or page number');
      }

      const document = await getDocumentWithBatch(
        documentId,
        req.accessibleStoreIds
      );

      const imageBuffer = await extractPageAsPng(
        document.batch.file_path,
        document.page_number
      );

      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': `private, max-age=${CACHE_MAX_AGE}`,
      });
      res.send(imageBuffer);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:documentId/thumbnail',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = parseInt(req.params['documentId'] ?? '', 10);

      if (isNaN(documentId)) {
        throw new BadRequestError('Invalid document ID');
      }

      const document = await getDocumentWithBatch(
        documentId,
        req.accessibleStoreIds
      );
      const imageBuffer = await extractPageAsPng(
        document.batch.file_path,
        document.page_number
      );

      const thumbnail = await sharp(imageBuffer)
        .resize(THUMBNAIL_WIDTH)
        .png()
        .toBuffer();

      res.set({
        'Content-Type': 'image/png',
        'Cache-Control': `private, max-age=${CACHE_MAX_AGE}`,
      });
      res.send(thumbnail);
    } catch (error) {
      logger.error('Thumbnail generation error:', error);
      next(error);
    }
  }
);

export default router;
