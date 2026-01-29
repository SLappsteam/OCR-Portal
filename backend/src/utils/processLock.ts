import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';
import { logger } from './logger';

const LOCK_FILE = path.join(__dirname, '..', '..', 'server.lock');

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(): void {
  if (existsSync(LOCK_FILE)) {
    const stalePid = parseInt(readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
    if (!isNaN(stalePid) && isProcessRunning(stalePid)) {
      logger.error(
        `Another server instance is already running (PID ${stalePid}). ` +
        `Kill it first: taskkill /PID ${stalePid} /F /T`
      );
      process.exit(1);
    }
    logger.warn(`Removing stale lock file (PID ${stalePid} is not running)`);
  }
  writeFileSync(LOCK_FILE, String(process.pid), 'utf-8');
  logger.info(`Process lock acquired (PID ${process.pid})`);
}

export function releaseLock(): void {
  try {
    if (existsSync(LOCK_FILE)) {
      const lockedPid = parseInt(readFileSync(LOCK_FILE, 'utf-8').trim(), 10);
      if (lockedPid === process.pid) {
        unlinkSync(LOCK_FILE);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}
