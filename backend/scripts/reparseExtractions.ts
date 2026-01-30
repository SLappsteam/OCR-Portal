import { PrismaClient } from '@prisma/client';
import { parseFinsalesPage, calculateConfidence } from '../src/services/extraction/finsalesParser';
import { parseSummaryText, isSummaryPage } from '../src/services/extraction/summaryParser';

const prisma = new PrismaClient();

async function main() {
  const extractions = await prisma.pageExtraction.findMany({
    where: { raw_text: { not: '' } },
    include: { document: { include: { documentType: true } } },
    orderBy: [{ document_id: 'asc' }, { page_number: 'asc' }],
  });

  console.log(`Re-parsing ${extractions.length} page extractions...`);
  let updated = 0;

  for (const ext of extractions) {
    const docType = ext.document.documentType?.code ?? '';
    if (docType !== 'FINSALES') continue;

    let fields: Record<string, unknown>;
    let confidence: number;

    if (isSummaryPage(ext.raw_text)) {
      const orders = parseSummaryText(ext.raw_text);
      fields = { orders };
      confidence = Math.min(orders.length / 5, 1);
    } else {
      const parsed = parseFinsalesPage(ext.raw_text);
      fields = parsed as Record<string, unknown>;
      confidence = calculateConfidence(parsed);
    }

    await prisma.pageExtraction.update({
      where: { id: ext.id },
      data: { fields, confidence },
    });
    updated++;
  }

  console.log(`Updated ${updated} extractions`);
  await prisma.$disconnect();
}

main().catch(console.error);
