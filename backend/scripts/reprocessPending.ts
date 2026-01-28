import { PrismaClient } from '@prisma/client';
import { processBatch } from '../src/services/batchProcessor';

const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.batch.findMany({
    where: { status: 'pending' },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${pending.length} pending batches to reprocess.`);

  for (const batch of pending) {
    console.log(`Processing batch ${batch.id} (${batch.file_name})...`);
    try {
      await processBatch(batch.id);
      console.log(`  Batch ${batch.id} completed.`);
    } catch (err) {
      console.error(`  Batch ${batch.id} failed:`, (err as Error).message);
    }
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
