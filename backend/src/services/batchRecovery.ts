import { prisma } from '../utils/prisma';
import { processTiffScan } from './batchProcessor';
import { logger } from '../utils/logger';

export async function recoverStuckBatches(): Promise<void> {
  const stuck = await prisma.batch.findMany({
    where: { status: 'processing', parent_batch_id: null },
    select: { id: true },
  });

  if (stuck.length === 0) return;

  logger.info(`Recovering ${stuck.length} batches stuck in processing`);

  const ids = stuck.map((b) => b.id);

  const childBatches = await prisma.batch.findMany({
    where: { parent_batch_id: { in: ids } },
    select: { id: true },
  });
  const childIds = childBatches.map((b) => b.id);

  if (childIds.length > 0) {
    await prisma.document.deleteMany({
      where: { batch_id: { in: childIds } },
    });
    await prisma.batch.deleteMany({
      where: { id: { in: childIds } },
    });
  }

  await prisma.document.deleteMany({
    where: { batch_id: { in: ids } },
  });

  await prisma.batch.updateMany({
    where: { id: { in: ids } },
    data: { status: 'pending', error_message: null, batch_type: null },
  });

  for (const { id } of stuck) {
    setImmediate(() => {
      processTiffScan(id).catch((err) => {
        logger.error(`Recovery reprocess failed for batch ${id}:`, err);
      });
    });
  }

  logger.info(`Requeued ${stuck.length} recovered batches`);
}
