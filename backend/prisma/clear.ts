import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Clearing database...');

  // Delete in correct order due to foreign keys
  await prisma.document.deleteMany();
  console.log('Deleted all documents');

  await prisma.batch.deleteMany();
  console.log('Deleted all batches');

  await prisma.store.deleteMany();
  console.log('Deleted all stores');

  console.log('Database cleared. Document types preserved.');
}

main()
  .catch((e) => {
    console.error('Clear failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
