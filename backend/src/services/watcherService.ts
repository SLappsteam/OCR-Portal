import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { stat } from 'fs/promises';
import { fileTypeFromFile } from 'file-type';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { calculateFileHash, parseStoreNumber } from '../utils/fileUtils';
import { storeFile, archiveFile } from './storageService';
import { processBatch } from './batchProcessor';

const prisma = new PrismaClient();

let watcher: FSWatcher | null = null;
const DEBOUNCE_MS = 2000;
const processingFiles = new Set<string>();

async function isValidTiff(filePath: string): Promise<boolean> {
  try {
    const type = await fileTypeFromFile(filePath);
    return type?.mime === 'image/tiff';
  } catch {
    return false;
  }
}

async function isDuplicateFile(fileHash: string): Promise<boolean> {
  const existing = await prisma.batch.findFirst({
    where: { file_name: { contains: fileHash.substring(0, 16) } },
  });
  return existing !== null;
}

async function getOrCreateStore(storeNumber: string): Promise<number> {
  let store = await prisma.store.findUnique({
    where: { store_number: storeNumber },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        store_number: storeNumber,
        name: `Store ${storeNumber}`,
      },
    });
    logger.info(`Created new store: ${storeNumber}`);
  }

  return store.id;
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

    const storeNumber = parseStoreNumber(filename);
    if (!storeNumber) {
      logger.warn(`Cannot parse store number from: ${filename}`);
      return;
    }

    const fileHash = await calculateFileHash(filePath);
    if (await isDuplicateFile(fileHash)) {
      logger.warn(`Duplicate file detected, skipping: ${filename}`);
      await archiveFile(filePath);
      return;
    }

    const fileStats = await stat(filePath);
    const storedPath = await storeFile(filePath, storeNumber);
    const storeId = await getOrCreateStore(storeNumber);

    const batch = await prisma.batch.create({
      data: {
        store_id: storeId,
        file_name: `${fileHash.substring(0, 16)}_${filename}`,
        file_path: storedPath,
        file_size_bytes: fileStats.size,
        status: 'pending',
      },
    });

    logger.info(`Created batch ${batch.id} for store ${storeNumber}`);

    await archiveFile(filePath);

    setImmediate(() => {
      processBatch(batch.id).catch((err) => {
        logger.error(`Background processing failed for batch ${batch.id}:`, err);
      });
    });
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
  });
}

export function stopWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    logger.info('File watcher stopped');
  }
}
