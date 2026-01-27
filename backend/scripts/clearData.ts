import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.deleteMany({});
  console.log('Deleted', docs.count, 'documents');

  const batches = await prisma.batch.deleteMany({});
  console.log('Deleted', batches.count, 'batches');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
