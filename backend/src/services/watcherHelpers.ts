import path from 'path';
import { stat } from 'fs/promises';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { calculateFileHash, parseLocationInfo, LocationInfo } from '../utils/fileUtils';
import { archiveFile } from './storageService';
import { processTiffScan } from './batchProcessor';

const MAX_REFERENCE_RETRIES = 10;
const UNASSIGNED_STORE = 'UNASSIGNED';
const REFERENCE_START = 100001;
const MAX_CONCURRENT_BATCHES = parseInt(process.env['MAX_CONCURRENT_BATCHES'] ?? '4', 10);

let activeBatches = 0;
const batchQueue: Array<() => void> = [];

export function acquireBatchSlot(): Promise<void> {
  if (activeBatches < MAX_CONCURRENT_BATCHES) {
    activeBatches++;
    return Promise.resolve();
  }
  return new Promise((resolve) => batchQueue.push(resolve));
}

export function releaseBatchSlot(): void {
  const next = batchQueue.shift();
  if (next) {
    next();
  } else {
    activeBatches--;
  }
}

export async function isDuplicateFile(fileHash: string): Promise<boolean> {
  const existing = await prisma.batch.findFirst({
    where: { file_hash: fileHash, parent_batch_id: null },
  });
  return existing !== null;
}

export async function getOrCreateLocation(locationInfo: LocationInfo): Promise<number> {
  const storeNumber = `${locationInfo.type === 'dc' ? 'DC' : 'ST'}${locationInfo.identifier}`;

  let store = await prisma.store.findUnique({
    where: { store_number: storeNumber },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        store_number: storeNumber,
        name: locationInfo.displayName,
      },
    });
    logger.info(`Created new location: ${locationInfo.displayName}`);
  }

  return store.id;
}

export async function getOrCreateUnassigned(): Promise<number> {
  let store = await prisma.store.findUnique({
    where: { store_number: UNASSIGNED_STORE },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        store_number: UNASSIGNED_STORE,
        name: 'Unassigned',
      },
    });
    logger.info('Created UNASSIGNED location');
  }

  return store.id;
}

async function generateReference(locationCode: string): Promise<string> {
  const lastBatch = await prisma.batch.findFirst({
    where: {
      reference: { startsWith: locationCode },
    },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });

  if (!lastBatch?.reference) {
    return `${locationCode}${REFERENCE_START}`;
  }

  const lastNumber = parseInt(lastBatch.reference.slice(locationCode.length), 10);
  const nextNumber = lastNumber + 1;
  return `${locationCode}${nextNumber}`;
}

export async function createBatchWithRetry(
  storeId: number,
  storageFolder: string,
  filename: string,
  fileHash: string,
  storedPath: string,
  fileSize: number
): Promise<{ id: number } | null> {
  for (let attempt = 0; attempt < MAX_REFERENCE_RETRIES; attempt++) {
    const reference = await generateReference(storageFolder);

    try {
      return await prisma.batch.create({
        data: {
          store_id: storeId,
          reference,
          file_hash: fileHash,
          file_name: filename,
          file_path: storedPath,
          file_size_bytes: fileSize,
          status: 'pending',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        logger.warn(`Reference collision on ${reference}, retrying (${attempt + 1}/${MAX_REFERENCE_RETRIES})...`);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to create batch after ${MAX_REFERENCE_RETRIES} retries`);
}

export interface FileInfo {
  filename: string;
  fileSize: number;
  fileHash: string;
  locationInfo: LocationInfo | null;
}

export async function validateAndHashFile(filePath: string): Promise<FileInfo | null> {
  const filename = path.basename(filePath);
  const locationInfo = parseLocationInfo(filename);

  if (!locationInfo) {
    logger.warn(`Cannot parse location from: ${filename}, assigning to UNASSIGNED`);
  }

  const fileStats = await stat(filePath);
  const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
  const fileHash = await calculateFileHash(filePath);

  logger.info(`  File: ${filename}, size=${sizeMB}MB, hash=${fileHash.substring(0, 12)}, location=${locationInfo?.displayName ?? 'UNASSIGNED'}`);

  return { filename, fileSize: fileStats.size, fileHash, locationInfo };
}

export function resolveStorageFolder(locationInfo: LocationInfo | null): string {
  return locationInfo
    ? `${locationInfo.type === 'dc' ? 'DC' : 'ST'}${locationInfo.identifier}`
    : UNASSIGNED_STORE;
}

export async function resolveStoreId(locationInfo: LocationInfo | null): Promise<number> {
  return locationInfo
    ? await getOrCreateLocation(locationInfo)
    : await getOrCreateUnassigned();
}

export async function archiveFileSafely(filePath: string, batchId?: number): Promise<void> {
  try {
    await archiveFile(filePath);
  } catch (archiveError) {
    if (batchId !== undefined) {
      logger.warn(`Failed to archive ${path.basename(filePath)}, but batch ${batchId} will still be processed:`, archiveError);
    }
    // Ignore archive errors for duplicates (batchId === undefined)
  }
}

export function scheduleBatchProcessing(
  batchId: number,
  filePath: string,
  processingFiles: Set<string>
): void {
  setImmediate(async () => {
    try {
      await acquireBatchSlot();
      try {
        await processTiffScan(batchId);
      } catch (err) {
        logger.error(`Background processing failed for batch ${batchId}:`, err);
      } finally {
        releaseBatchSlot();
      }
    } catch (slotErr) {
      logger.error(`Failed to acquire batch slot for batch ${batchId}:`, slotErr);
    } finally {
      processingFiles.delete(filePath);
    }
  });
}
