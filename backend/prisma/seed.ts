import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const documentTypes = [
  // Slumberland document types from coversheets
  {
    code: 'CDR',
    name: 'CDR Paperwork',
    description: 'Cash drawer reconciliation documents',
  },
  {
    code: 'APINV',
    name: 'AP Invoice',
    description: 'Accounts payable invoices',
  },
  {
    code: 'ATOMRCV',
    name: 'A to M Receiving',
    description: 'Receiving paperwork for vendors A-M',
  },
  {
    code: 'MTOZRCV',
    name: 'M to Z Receiving',
    description: 'Receiving paperwork for vendors M-Z',
  },
  {
    code: 'LBRCV',
    name: 'La-Z-Boy Receiving',
    description: 'La-Z-Boy receiving paperwork',
  },
  {
    code: 'REFUND',
    name: 'Cash/Check Refund Vouchers',
    description: 'Refund voucher documents',
  },
  {
    code: 'EXPENSE',
    name: 'Expense Report',
    description: 'Expense reports and reimbursements',
  },
  {
    code: 'FINSALES',
    name: 'Finalized Sales',
    description: 'Finalized sales transactions',
  },
  {
    code: 'FINTRAN',
    name: 'Financing Transactions',
    description: 'Customer financing transactions',
  },
  {
    code: 'LOFTFIN',
    name: 'Loft Financing',
    description: 'Loft financing transactions',
  },
  {
    code: 'WFDEP',
    name: 'Wells Fargo Deposits',
    description: 'Wells Fargo bank deposit slips',
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
