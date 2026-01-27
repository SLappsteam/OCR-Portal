import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { stat } from 'fs/promises';
import sharp from 'sharp';
import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { calculateFileHash, parseLocationInfo, LocationInfo } from '../utils/fileUtils';
import { storeFile, archiveFile } from './storageService';
import { processBatch } from './batchProcessor';
import { setWatcherStatus } from '../routes/settings';

const prisma = new PrismaClient();
const MAX_REFERENCE_RETRIES = 10;

let watcher: FSWatcher | null = null;
const DEBOUNCE_MS = 2000;
const processingFiles = new Set<string>();

async function isValidTiff(filePath: string): Promise<boolean> {
  try {
    const metadata = await sharp(filePath).metadata();
    return metadata.format === 'tiff';
  } catch {
    return false;
  }
}

async function isDuplicateFile(fileHash: string): Promise<boolean> {
  const existing = await prisma.batch.findUnique({
    where: { file_hash: fileHash },
  });
  return existing !== null;
}

async function getOrCreateLocation(locationInfo: LocationInfo): Promise<number> {
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

async function getOrCreateUnassigned(): Promise<number> {
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

const UNASSIGNED_STORE = 'UNASSIGNED';
const REFERENCE_START = 100001;

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

async function createBatchWithRetry(
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
        const target = error.meta?.['target'] as string[] | undefined;
        if (target?.includes('file_hash')) {
          logger.warn(`Duplicate file detected for ${filename} (hash: ${fileHash.substring(0, 16)})`);
          return null;
        }
        logger.warn(`Reference collision on ${reference}, retrying (${attempt + 1}/${MAX_REFERENCE_RETRIES})...`);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to create batch after ${MAX_REFERENCE_RETRIES} retries`);
}

async function processNewFile(filePath: string): Promise<void> {
  const filename = path.basename(filePath);

  if (processingFiles.has(filePath)) {
    return;
  }
  processingFiles.add(filePath);

  try {
    logger.info(`Processing new file: ${filename}`);

    const isValid = await isValidTiff(filePath);
    if (!isValid) {
      logger.warn(`Invalid TIFF file, skipping: ${filename}`);
      return;
    }

    const locationInfo = parseLocationInfo(filename);

    if (!locationInfo) {
      logger.warn(`Cannot parse location from: ${filename}, using UNASSIGNED`);
    }

    const fileHash = await calculateFileHash(filePath);
    if (await isDuplicateFile(fileHash)) {
      logger.warn(`Duplicate file detected, skipping: ${filename}`);
      await archiveFile(filePath);
      return;
    }

    const storageFolder = locationInfo
      ? `${locationInfo.type === 'dc' ? 'DC' : 'ST'}${locationInfo.identifier}`
      : UNASSIGNED_STORE;

    const fileStats = await stat(filePath);
    const storedPath = await storeFile(filePath, storageFolder);
    const storeId = locationInfo
      ? await getOrCreateLocation(locationInfo)
      : await getOrCreateUnassigned();

    const batch = await createBatchWithRetry(
      storeId,
      storageFolder,
      filename,
      fileHash,
      storedPath,
      fileStats.size
    );

    if (!batch) {
      // Duplicate detected during batch creation - just archive the file
      try {
        await archiveFile(filePath);
      } catch {
        // Ignore archive errors for duplicates
      }
      return;
    }

    logger.info(`Created batch ${batch.id} for ${locationInfo?.displayName ?? 'UNASSIGNED'}`);

    setImmediate(() => {
      processBatch(batch.id).catch((err) => {
        logger.error(`Background processing failed for batch ${batch.id}:`, err);
      });
    });

    try {
      await archiveFile(filePath);
    } catch (archiveError) {
      logger.warn(`Failed to archive ${filename}, but batch ${batch.id} will still be processed:`, archiveError);
    }
  } catch (error) {
    logger.error(`Error processing file ${filename}:`, error);
  } finally {
    processingFiles.delete(filePath);
  }
}

export function startWatcher(watchPath: string): void {
  if (watcher) {
    logger.warn('Watcher already running');
    return;
  }

  logger.info(`Starting file watcher on: ${watchPath}`);

  watcher = chokidar.watch(watchPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: DEBOUNCE_MS,
      pollInterval: 100,
    },
  });

  watcher.on('add', (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.tif' || ext === '.tiff') {
      processNewFile(filePath);
    }
  });

  watcher.on('error', (error) => {
    logger.error('Watcher error:', error);
  });

  watcher.on('ready', () => {
    logger.info('File watcher ready and monitoring for new TIFFs');
    setWatcherStatus(true);
  });
}

export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    setWatcherStatus(false);
    logger.info('File watcher stopped');
  }
}
