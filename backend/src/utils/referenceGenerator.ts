import { prisma } from './prisma';

export const REFERENCE_START = 100001;

export async function generateReference(locationCode: string): Promise<string> {
  const lastBatch = await prisma.batch.findFirst({
    where: { reference: { startsWith: locationCode } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });

  if (!lastBatch?.reference) {
    return `${locationCode}${REFERENCE_START}`;
  }

  const lastNumber = parseInt(
    lastBatch.reference.slice(locationCode.length), 10
  );
  return `${locationCode}${lastNumber + 1}`;
}
