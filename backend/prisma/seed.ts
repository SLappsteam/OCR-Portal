import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const documentTypes = [
  {
    code: 'INVOICE',
    name: 'Invoice',
    description: 'Vendor invoices and bills',
  },
  {
    code: 'PO',
    name: 'Purchase Order',
    description: 'Purchase orders for inventory and supplies',
  },
  {
    code: 'RECEIPT',
    name: 'Receipt',
    description: 'Customer receipts and transaction records',
  },
  {
    code: 'CONTRACT',
    name: 'Contract',
    description: 'Legal contracts and agreements',
  },
  {
    code: 'DELIVERY',
    name: 'Delivery Ticket',
    description: 'Delivery confirmation and shipping documents',
  },
  {
    code: 'OTHER',
    name: 'Other',
    description: 'Miscellaneous documents',
  },
  {
    code: 'UNCLASSIFIED',
    name: 'Unclassified Document',
    description: 'Documents without barcode identification',
  },
];

async function main(): Promise<void> {
  console.log('Seeding database...');

  for (const docType of documentTypes) {
    await prisma.documentType.upsert({
      where: { code: docType.code },
      update: docType,
      create: docType,
    });
    console.log(`Upserted document type: ${docType.code}`);
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
