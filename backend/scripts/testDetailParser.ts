import { PrismaClient } from '@prisma/client';
import { parseFinsalesText, calculateConfidence } from '../src/services/extraction/finsalesParser';

const prisma = new PrismaClient();

async function main() {
  const extractions = await prisma.pageExtraction.findMany({
    where: { document: { reference: 'ST78-563' }, page_number: { gte: 2, lte: 5 } },
    orderBy: { page_number: 'asc' },
  });

  for (const ext of extractions) {
    console.log(`\n=== Page ${ext.page_number} ===`);
    const fields = parseFinsalesText(ext.raw_text);
    const conf = calculateConfidence(fields);
    console.log(`Confidence: ${(conf * 100).toFixed(0)}%`);
    for (const [k, v] of Object.entries(fields)) {
      if (v !== null) console.log(`  ${k}: ${v}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
