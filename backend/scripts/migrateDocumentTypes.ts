import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migrate document types to new structure:
 * - Create INVOICE, UNKNOWN document types
 * - Migrate FINSALES/FINTRAN documents to INVOICE
 * - Keep MANIFEST
 * - Remove batch-type entries from document_types table (they're just for batches)
 */
async function migrateDocumentTypes() {
  console.log('Starting document type migration...');

  // 1. Create INVOICE type if not exists
  const invoiceType = await prisma.documentType.upsert({
    where: { code: 'INVOICE' },
    create: {
      code: 'INVOICE',
      name: 'Invoice',
      description: 'Sales invoice, financing agreement, or ticket',
      is_active: true,
    },
    update: {},
  });
  console.log(`INVOICE type: id=${invoiceType.id}`);

  // 2. Create UNKNOWN type if not exists
  const unknownType = await prisma.documentType.upsert({
    where: { code: 'UNKNOWN' },
    create: {
      code: 'UNKNOWN',
      name: 'Unknown',
      description: 'Document type could not be determined',
      is_active: true,
    },
    update: {},
  });
  console.log(`UNKNOWN type: id=${unknownType.id}`);

  // 3. Ensure MANIFEST exists
  const manifestType = await prisma.documentType.upsert({
    where: { code: 'MANIFEST' },
    create: {
      code: 'MANIFEST',
      name: 'Sales Manifest',
      description: 'Daily sales summary/manifest page listing multiple orders',
      is_active: true,
    },
    update: {},
  });
  console.log(`MANIFEST type: id=${manifestType.id}`);

  // 4. Find old FINSALES and FINTRAN types
  const finsalesType = await prisma.documentType.findUnique({ where: { code: 'FINSALES' } });
  const fintranType = await prisma.documentType.findUnique({ where: { code: 'FINTRAN' } });

  // 5. Migrate documents from FINSALES/FINTRAN to INVOICE
  const typeIdsToMigrate = [finsalesType?.id, fintranType?.id].filter((id): id is number => id !== undefined);

  if (typeIdsToMigrate.length > 0) {
    const migrated = await prisma.document.updateMany({
      where: { document_type_id: { in: typeIdsToMigrate } },
      data: { document_type_id: invoiceType.id },
    });
    console.log(`Migrated ${migrated.count} documents to INVOICE`);
  }

  // 6. Migrate UNCLASSIFIED/OTHER documents to UNKNOWN
  const unclassifiedType = await prisma.documentType.findUnique({ where: { code: 'UNCLASSIFIED' } });
  const otherType = await prisma.documentType.findUnique({ where: { code: 'OTHER' } });
  const unknownTypeIds = [unclassifiedType?.id, otherType?.id].filter((id): id is number => id !== undefined);

  if (unknownTypeIds.length > 0) {
    const migratedUnknown = await prisma.document.updateMany({
      where: { document_type_id: { in: unknownTypeIds } },
      data: { document_type_id: unknownType.id },
    });
    console.log(`Migrated ${migratedUnknown.count} documents to UNKNOWN`);
  }

  // 7. Delete old batch-type document types (no longer used as document types)
  const batchTypeCodes = [
    'CDR', 'APINV', 'ATOMRCV', 'MTOZRCV', 'LBRCV',
    'REFUND', 'EXPENSE', 'FINSALES', 'FINTRAN', 'LOFTFIN', 'WFDEP',
    'UNCLASSIFIED', 'OTHER',
  ];

  for (const code of batchTypeCodes) {
    // Check if any documents still reference this type
    const docType = await prisma.documentType.findUnique({ where: { code } });
    if (!docType) continue;

    const docsWithType = await prisma.document.count({
      where: { document_type_id: docType.id },
    });

    if (docsWithType === 0) {
      await prisma.documentType.delete({ where: { code } });
      console.log(`Deleted unused document type: ${code}`);
    } else {
      console.log(`Skipped ${code}: ${docsWithType} documents still reference it`);
    }
  }

  // 8. Show final document type list
  const allTypes = await prisma.documentType.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });
  console.log('\nFinal document types:');
  for (const t of allTypes) {
    console.log(`  ${t.code}: ${t.name} (id=${t.id})`);
  }
}

migrateDocumentTypes()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
