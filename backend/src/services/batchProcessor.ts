import { PrismaClient } from '@prisma/client';
import { analyzeTiff } from './documentSplitter';
import { getDocumentTypeByCode } from './barcodeService';
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

async function createDocumentRecord(
  batchId: number,
  storeNumber: string,
  boundary: {
    documentTypeCode: string;
    startPage: number;
    endPage: number;
  }
): Promise<void> {
  const docType = await getDocumentTypeByCode(boundary.documentTypeCode);

  const doc = await prisma.document.create({
    data: {
      batch_id: batchId,
      document_type_id: docType?.id ?? null,
      page_start: boundary.startPage,
      page_end: boundary.endPage,
      status: 'pending',
    },
  });

  await prisma.document.update({
    where: { id: doc.id },
    data: { reference: `${storeNumber}-${doc.id}` },
  });
}

export async function processBatch(batchId: number): Promise<void> {
  logger.info(`Starting batch processing for batch ID: ${batchId}`);

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: { store: true },
  });

  if (!batch) {
    throw new Error(`Batch ${batchId} not found`);
  }

  const storeNumber = batch.store.store_number;

  if (batch.status === 'processing') {
    throw new Error(`Batch ${batchId} is already being processed`);
  }

  try {
    await updateBatchStatus(batchId, 'processing');

    const boundaries = await analyzeTiff(batch.file_path);

    for (const boundary of boundaries) {
      if (boundary) {
        await createDocumentRecord(batchId, storeNumber, boundary);
      }
    }

    await prisma.batch.update({
      where: { id: batchId },
      data: {
        page_count: boundaries.reduce(
          (sum, b) => sum + (b.endPage - b.startPage + 1),
          0
        ),
      },
    });

    await prisma.document.updateMany({
      where: { batch_id: batchId },
      data: { status: 'completed' },
    });

    await updateBatchStatus(batchId, 'completed');
    logger.info(`Batch ${batchId} completed: ${boundaries.length} documents`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Batch ${batchId} failed:`, error);
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
