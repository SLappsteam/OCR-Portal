import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { extractPageAsPng } from '../services/tiffService';
import { BadRequestError, NotFoundError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

const THUMBNAIL_WIDTH = 300;
const CACHE_MAX_AGE = 300;

async function getDocumentWithBatch(documentId: number) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { batch: true },
  });

  if (!document) {
    throw new NotFoundError('Document not found');
  }

  return document;
}

function calculateActualPage(document: { page_start: number }, pageNumber: number): number {
  return document.page_start + (pageNumber - 1);
}

router.get(
  '/:documentId/:pageNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documentId = parseInt(req.params['documentId'] ?? '', 10);
      const pageNumber = parseInt(req.params['pageNumber'] ?? '', 10);

      if (isNaN(documentId) || isNaN(pageNumber) || pageNumber < 1) {
        throw new BadRequestError('Invalid document ID or page number');
      }

      const document = await getDocumentWithBatch(documentId);
      const pageCount = document.page_end - document.page_start + 1;

      if (pageNumber > pageCount) {
        throw new BadRequestError(
          `Page ${pageNumber} exceeds document page count (${pageCount})`
        );
      }

      const actualPage = calculateActualPage(document, pageNumber);
      const imageBuffer = await extractPageAsPng(
        document.batch.file_path,
        actualPage
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

      const document = await getDocumentWithBatch(documentId);
      const imageBuffer = await extractPageAsPng(
        document.batch.file_path,
        document.page_start
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
