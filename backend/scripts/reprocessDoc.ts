import { PrismaClient, Prisma } from '@prisma/client';
import { extractAllPages } from '../src/services/extraction';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function reprocessDocument(docId: number) {
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: {
      batch: true,
      documentType: true,
    },
  });

  if (!doc) {
    console.error(`Document ${docId} not found`);
    return;
  }

  const docTypeCode = doc.documentType?.code ?? 'UNKNOWN';
  console.log(`Reprocessing ${doc.reference}: type=${docTypeCode}, pages ${doc.page_start}-${doc.page_end}`);
  console.log(`File: ${doc.batch.file_path}`);

  const deleted = await prisma.pageExtraction.deleteMany({
    where: { document_id: docId },
  });
  console.log(`Deleted ${deleted.count} old extractions`);

  const pages = await extractAllPages(
    doc.batch.file_path,
    doc.page_start,
    doc.page_end,
    docTypeCode
  );

  const coversheetRow = {
    document_id: docId,
    page_number: doc.page_start,
    fields: { document_type: docTypeCode } as unknown as Prisma.JsonObject,
    raw_text: '',
    confidence: 1.0,
  };

  const contentRows = pages.map((p: { page_number: number; fields: unknown; raw_text: string; confidence: number }) => ({
    document_id: docId,
    page_number: p.page_number,
    fields: p.fields as unknown as Prisma.JsonObject,
    raw_text: p.raw_text,
    confidence: p.confidence,
  }));

  await prisma.pageExtraction.createMany({
    data: [coversheetRow, ...contentRows],
  });

  console.log(`Stored ${contentRows.length + 1} new extractions (1 coversheet + ${contentRows.length} content)`);

  for (const row of contentRows) {
    const fields = row.fields as Record<string, unknown>;
    console.log(
      `  Page ${row.page_number}: conf=${((row.confidence) * 100).toFixed(0)}% ` +
      `order=${fields['order_id'] ?? '-'} customer=${fields['customer_name'] ?? '-'}`
    );
  }
}

const docId = parseInt(process.argv[2] ?? '', 10);
if (isNaN(docId)) {
  console.error('Usage: npx ts-node scripts/reprocessDoc.ts <document_id>');
  process.exit(1);
}

reprocessDocument(docId)
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  });
