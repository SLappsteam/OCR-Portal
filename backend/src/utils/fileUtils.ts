import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { logger } from './logger';

const STORE_NUMBER_PATTERN = /ST(\d{2})/i;

export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => {
      logger.error(`Error calculating hash for ${filePath}:`, err);
      reject(err);
    });
  });
}

export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EEXIST') {
      logger.error(`Error creating directory ${dirPath}:`, error);
      throw error;
    }
  }
}

export function parseStoreNumber(filename: string): string | null {
  const match = filename.match(STORE_NUMBER_PATTERN);
  if (!match?.[1]) {
    return null;
  }
  return match[1];
}

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
