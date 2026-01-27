import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { logger } from './logger';

export interface LocationInfo {
  type: 'store' | 'dc';
  identifier: string;
  displayName: string;
}

const LOCATION_PATTERN = /^(ST|DC)([A-Z0-9]{1,2})/i;

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

export function parseLocationInfo(filename: string): LocationInfo | null {
  const match = filename.match(LOCATION_PATTERN);
  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const typeCode = match[1].toUpperCase();
  const identifier = match[2].toUpperCase();

  const type = typeCode === 'DC' ? 'dc' : 'store';
  const displayName = type === 'dc' ? `DC ${identifier}` : identifier;

  return { type, identifier, displayName };
}

// Deprecated: use parseLocationInfo instead
export function parseStoreNumber(filename: string): string | null {
  const info = parseLocationInfo(filename);
  return info ? `${info.type === 'dc' ? 'DC' : 'ST'}${info.identifier}` : null;
}

export async function getFileSize(filePath: string): Promise<number> {
  const stats = await stat(filePath);
  return stats.size;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}
