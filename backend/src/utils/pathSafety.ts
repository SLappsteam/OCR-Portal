import path from 'path';

const TIFF_STORAGE_PATH = process.env['TIFF_STORAGE_PATH'] ?? './storage/tiffs';
const WATCH_FOLDER_PATH = process.env['WATCH_FOLDER_PATH'] ?? './watch';
const ARCHIVE_FOLDER_PATH = process.env['ARCHIVE_FOLDER_PATH'] ?? './storage/archive';

const ALLOWED_ROOTS = [
  path.resolve(TIFF_STORAGE_PATH),
  path.resolve(WATCH_FOLDER_PATH),
  path.resolve(ARCHIVE_FOLDER_PATH),
].filter(Boolean);

/**
 * Validates that a file path resolves to within one of the allowed
 * storage directories. Prevents path traversal and UNC path attacks.
 *
 * @throws Error if path is outside allowed roots
 */
export function assertPathContained(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }

  // Block UNC paths (\\server\share) and protocol-like prefixes
  if (/^\\\\/.test(filePath) || /^[a-z]+:\/\//i.test(filePath)) {
    throw new Error('UNC and remote paths are not allowed');
  }

  // Block null bytes (can bypass string checks in some runtimes)
  if (filePath.includes('\0')) {
    throw new Error('Invalid file path');
  }

  const resolved = path.resolve(filePath);
  const normalized = path.normalize(resolved);

  const isContained = ALLOWED_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(root + path.sep)
  );

  if (!isContained) {
    throw new Error('File path is outside allowed directories');
  }

  return normalized;
}

/**
 * Validates that a value is a safe positive integer (for PID, port, etc.).
 * Returns the parsed number or null if invalid.
 */
export function parseSafeInteger(
  value: unknown,
  min = 1,
  max = 65535
): number | null {
  const num = typeof value === 'string' ? parseInt(value, 10) : Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    return null;
  }
  return num;
}
