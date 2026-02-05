import { prisma } from '../utils/prisma';
import { getDocumentTypeByCode } from './barcodeService';
import { logger } from '../utils/logger';
import { generateReference } from '../utils/referenceGenerator';

export function generateChildReference(
  parentRef: string,
  index: number
): string {
  return `${parentRef}-${index + 1}`;
}

export async function createChildBatch(
  parentBatch: {
    id: number;
    store_id: number;
    file_hash: string;
    file_name: string;
    file_path: string;
    file_size_bytes: bigint | null;
    store: { store_number: string };
  },
  batchTypeCode: string,
  pageCount: number
): Promise<{ id: number; reference: string }> {
  const locationCode = parentBatch.store.store_number;
  const reference = await generateReference(locationCode);

  const child = await prisma.batch.create({
    data: {
      store_id: parentBatch.store_id,
      reference,
      file_hash: parentBatch.file_hash,
      file_name: parentBatch.file_name,
      file_path: parentBatch.file_path,
      file_size_bytes: parentBatch.file_size_bytes,
      page_count: pageCount,
      batch_type: batchTypeCode,
      parent_batch_id: parentBatch.id,
      status: 'processing',
    },
  });

  logger.info(
    `Created child batch ${child.id} (ref=${reference}) ` +
    `type=${batchTypeCode}, ${pageCount} pages, parent=${parentBatch.id}`
  );

  return { id: child.id, reference };
}

export async function createPageDocument(
  batchId: number,
  storeNumber: string,
  pageNumber: number,
  docTypeCode?: string,
  isCoversheet = false
): Promise<number> {
  const docType = docTypeCode
    ? await getDocumentTypeByCode(docTypeCode)
    : null;

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        batch_id: batchId,
        document_type_id: docType?.id ?? null,
        page_number: pageNumber,
        is_coversheet: isCoversheet,
        status: 'pending',
      },
    });

    const reference = `${storeNumber}-${created.id}`;
    await tx.document.update({
      where: { id: created.id },
      data: { reference },
    });

    return created;
  });

  const reference = `${storeNumber}-${doc.id}`;
  logger.info(
    `  Created document ${reference}: page=${pageNumber}` +
    (isCoversheet ? ' [coversheet]' : '') +
    (docTypeCode ? `, type=${docTypeCode}` : '')
  );

  return doc.id;
}
