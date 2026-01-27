import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.document.findMany({
    include: {
      documentType: true,
      batch: { select: { reference: true } }
    }
  });

  console.log('Documents after reprocessing:');
  docs.forEach(d => {
    console.log(
      ' ', d.batch.reference,
      '| pages', d.page_start, '-', d.page_end,
      '|', d.documentType?.code ?? 'NULL'
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
