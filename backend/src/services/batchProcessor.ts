import { PrismaClient, Prisma } from '@prisma/client';
import { analyzeTiff, type BatchSection, type AnalyzeResult } from './documentSplitter';
import { createPageDocument } from './batchCreator';
import { extractSinglePage } from './extraction/extractFields';
import { classifyPageContent } from './cdrScanner';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

async function updateBatchStatus(
  batchId: number,
  status: BatchStatus,
  errorMessage?: string
): Promise<void> {
  await prisma.batch.update({
    where: { id: batchId },
    data: {
      status,
      error_message: errorMessage ?? null,
      processed_at: status === 'completed' ? new Date() : undefined,
    },
  });
}

async function extractAndStorePage(
  docId: number,
  filePath: string,
  pageNumber: number,
  docTypeCode: string,
  isCoversheet: boolean
): Promise<void> {
  try {
    if (isCoversheet) {
      await prisma.pageExtraction.create({
        data: {
          document_id: docId,
          page_number: pageNumber,
          fields: { document_type: docTypeCode } as Prisma.JsonObject,
          raw_text: '',
          confidence: 1.0,
        },
      });
      return;
    }

    const result = await extractSinglePage(
      filePath, pageNumber, docTypeCode
    );

    if (result) {
      await prisma.pageExtraction.create({
        data: {
          document_id: docId,
          page_number: result.page_number,
          fields: {
            document_type: docTypeCode,
            ...result.fields,
          } as unknown as Prisma.JsonObject,
          raw_text: result.raw_text,
          confidence: result.confidence,
        },
      });
    }
  } catch (error) {
    logger.error(`Page extraction failed for doc ${docId} page ${pageNumber}:`, error);
  }
}

async function processSectionPages(
  batchId: number,
  storeNumber: string,
  filePath: string,
  section: BatchSection
): Promise<void> {
  for (let i = 0; i < section.pages.length; i++) {
    const page = section.pages[i]!;
    const isCoversheet = i === 0 && section.documentTypeCode !== 'UNCLASSIFIED';

    const docId = await createPageDocument(
      batchId, storeNumber, page, section.documentTypeCode, isCoversheet
    );

    await extractAndStorePage(
      docId, filePath, page, section.documentTypeCode, isCoversheet
    );

    if (!isCoversheet) {
      await classifyPageContent(docId, filePath, page);
    }

    await prisma.document.update({
      where: { id: docId },
      data: { status: 'completed' },
    });
  }
}

export async function processTiffScan(batchId: number): Promise<void> {
  logger.info(`Starting batch processing for batch ID: ${batchId}`);

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { store: true },
  });

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  if (batch.status === 'processing') {
    throw new Error(`Batch ${batchId} is already being processed`);
  }

  const storeNumber = batch.store.store_number;
  const startTime = Date.now();

  try {
    await updateBatchStatus(batchId, 'processing');
    logger.info(`Batch ${batchId}: store=${storeNumber}, file=${batch.file_name}`);

    const { sections, totalPageCount } = await analyzeTiff(batch.file_path);

    if (sections.length === 0) {
      await prisma.batch.update({
        where: { id: batchId },
        data: { page_count: totalPageCount },
      });
      await updateBatchStatus(batchId, 'completed');
      return;
    }

    // Set page_count to actual TIFF page count
    const firstSection = sections[0]!;
    await prisma.batch.update({
      where: { id: batchId },
      data: {
        batch_type: firstSection.documentTypeCode,
        page_count: totalPageCount,
      },
    });

    // Process all sections under one batch - no child batches
    for (const section of sections) {
      await processSectionPages(
        batchId, storeNumber, batch.file_path, section
      );
    }

    await updateBatchStatus(batchId, 'completed');
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      `Batch ${batchId} completed: ${sections.length} sections, ` +
      `${totalPageCount} total pages in ${elapsed}s`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.error(`Batch ${batchId} failed after ${elapsed}s:`, error);
    await updateBatchStatus(batchId, 'failed', message);
    throw error;
  }
}

export async function getBatchStatus(
  batchId: number
): Promise<{ status: string; documentCount: number }> {
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { _count: { select: { documents: true } } },
  });

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  return {
    status: batch.status,
    documentCount: batch._count.documents,
  };
}
