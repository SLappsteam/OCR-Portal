import { copyFile, mkdir, rename, unlink } from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

const TIFF_STORAGE_PATH = process.env['TIFF_STORAGE_PATH'] ?? './storage/tiffs';
const ARCHIVE_FOLDER_PATH = process.env['ARCHIVE_FOLDER_PATH'] ?? '';

function getYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getStoragePath(storeNumber: string, filename: string): string {
  const yearMonth = getYearMonth();
  return path.join(TIFF_STORAGE_PATH, storeNumber, yearMonth, filename);
}

export async function storeFile(
  sourcePath: string,
  storeNumber: string
): Promise<string> {
  const filename = path.basename(sourcePath);
  const destPath = getStoragePath(storeNumber, filename);
  const destDir = path.dirname(destPath);

  await mkdir(destDir, { recursive: true });
  await copyFile(sourcePath, destPath);

  logger.info(`Stored file: ${sourcePath} -> ${destPath}`);
  return destPath;
}

export async function archiveFile(sourcePath: string): Promise<void> {
  if (!ARCHIVE_FOLDER_PATH) {
    await unlink(sourcePath);
    logger.info(`Deleted source file: ${sourcePath}`);
    return;
  }

  const filename = path.basename(sourcePath);
  const yearMonth = getYearMonth();
  const archiveDir = path.join(ARCHIVE_FOLDER_PATH, yearMonth);
  const archivePath = path.join(archiveDir, filename);

  await mkdir(archiveDir, { recursive: true });
  await rename(sourcePath, archivePath);

  logger.info(`Archived file: ${sourcePath} -> ${archivePath}`);
}

export async function ensureStorageDirectories(): Promise<void> {
  await mkdir(TIFF_STORAGE_PATH, { recursive: true });
  if (ARCHIVE_FOLDER_PATH) {
    await mkdir(ARCHIVE_FOLDER_PATH, { recursive: true });
  }
  logger.info('Storage directories initialized');
}
