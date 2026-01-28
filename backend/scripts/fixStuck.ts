import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stuck = await prisma.batch.findMany({
    where: { status: 'processing' },
    include: { store: true, _count: { select: { documents: true } } },
  });

  console.log(`Batches stuck in 'processing': ${stuck.length}`);
  for (const b of stuck) {
    console.log(`  Batch ${b.id} | ${b.reference} | ${b.store.store_number} | ${b.file_name} | docs: ${b._count.documents}`);
  }

  if (stuck.length === 0) return;

  // Reset them to 'pending' so they get reprocessed
  const ids = stuck.map(b => b.id);
  await prisma.batch.updateMany({
    where: { id: { in: ids } },
    data: { status: 'pending' },
  });

  // Delete any partial documents from the failed processing
  await prisma.document.deleteMany({
    where: { batch_id: { in: ids } },
  });

  console.log(`\nReset ${ids.length} batches to 'pending' and cleared partial documents.`);
  console.log('They will be reprocessed on next batch processor run.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
