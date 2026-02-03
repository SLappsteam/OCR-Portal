import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addManifestType() {
  const existing = await prisma.documentType.findUnique({
    where: { code: 'MANIFEST' },
  });

  if (existing) {
    console.log('MANIFEST document type already exists');
    return;
  }

  await prisma.documentType.create({
    data: {
      code: 'MANIFEST',
      name: 'Sales Manifest',
      description: 'Daily sales summary/manifest page listing multiple orders',
      is_active: true,
    },
  });

  console.log('Created MANIFEST document type');
}

addManifestType()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
