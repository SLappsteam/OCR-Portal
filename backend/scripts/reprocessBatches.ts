import { PrismaClient } from '@prisma/client';
import { processBatch } from '../src/services/batchProcessor';

const prisma = new PrismaClient();

async function main() {
  await prisma.document.deleteMany({});
  console.log('Cleared existing documents');

  const batches = await prisma.batch.findMany();
  console.log('Reprocessing', batches.length, 'batches...');

  for (const batch of batches) {
    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: 'pending' }
    });

    try {
      await processBatch(batch.id);
      console.log('Reprocessed batch', batch.id, batch.reference);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed batch', batch.id, message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
