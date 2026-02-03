import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create COVERSHEET document type
  const coversheet = await prisma.documentType.upsert({
    where: { code: 'COVERSHEET' },
    create: {
      code: 'COVERSHEET',
      name: 'Coversheet',
      description: 'Batch separator page with barcode',
      is_active: true,
    },
    update: {},
  });
  console.log(`COVERSHEET type: id=${coversheet.id}`);

  // Update existing coversheet documents to have this type
  const updated = await prisma.document.updateMany({
    where: { is_coversheet: true, document_type_id: null },
    data: { document_type_id: coversheet.id },
  });
  console.log(`Updated ${updated.count} existing coversheet documents`);

  // Show all document types
  const types = await prisma.documentType.findMany({
    orderBy: { code: 'asc' },
  });
  console.log('\nDocument types:');
  for (const t of types) {
    console.log(`  ${t.code}: ${t.name} (id=${t.id})`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
