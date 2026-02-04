import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import { storeFile, archiveFile } from './storageService';
import { setWatcherStatus } from '../routes/settings';
import {
  isDuplicateFile,
  validateAndHashFile,
  FileInfo,
  resolveStorageFolder,
  resolveStoreId,
  createBatchWithRetry,
  archiveFileSafely,
  scheduleBatchProcessing,
} from './watcherHelpers';

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

async function ingestValidatedFile(
  filePath: string,
  fileInfo: FileInfo
): Promise<{ id: number } | null> {
  const storageFolder = resolveStorageFolder(fileInfo.locationInfo);
  const storedPath = await storeFile(filePath, storageFolder);
  const storeId = await resolveStoreId(fileInfo.locationInfo);

  const batch = await createBatchWithRetry(
    storeId, storageFolder, fileInfo.filename,
    fileInfo.fileHash, storedPath, fileInfo.fileSize
  );

  if (!batch) {
    await archiveFileSafely(filePath);
    return null;
  }

  logger.info(`  Created batch ${batch.id} (ref=${storageFolder}) for ${fileInfo.locationInfo?.displayName ?? 'UNASSIGNED'}`);
  await archiveFileSafely(filePath, batch.id);
  return batch;
}

async function processNewFile(filePath: string): Promise<void> {
  const filename = path.basename(filePath);

  if (processingFiles.has(filePath)) {
    return;
  }
  processingFiles.add(filePath);

  let handedOffToBackground = false;

  try {
    logger.info(`Incoming file: ${filename}`);

    const isValid = await isValidTiff(filePath);
    if (!isValid) {
      logger.warn(`Invalid TIFF file, skipping: ${filename}`);
      return;
    }

    const fileInfo = await validateAndHashFile(filePath);
    if (!fileInfo) return;

    if (await isDuplicateFile(fileInfo.fileHash)) {
      logger.warn(`  Duplicate file detected, skipping: ${filename} (hash=${fileInfo.fileHash.substring(0, 12)})`);
      await archiveFile(filePath);
      return;
    }

    const batch = await ingestValidatedFile(filePath, fileInfo);
    if (!batch) return;

    handedOffToBackground = true;
    scheduleBatchProcessing(batch.id, filePath, processingFiles);
  } catch (error) {
    logger.error(`Error processing file ${filename}:`, error);
  } finally {
    if (!handedOffToBackground) {
      processingFiles.delete(filePath);
    }
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
    ignoreInitial: false,
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
