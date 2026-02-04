import { execSync } from 'child_process';
import { logger } from './logger';

const DEFAULT_PORT = 3000;

/**
 * Finds the PID of the process using a given port (Windows-only)
 */
function findProcessOnPort(port: number): number | null {
  try {
    const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const match = result.trim().split('\n')[0]?.match(/\s+(\d+)\s*$/);
    return match?.[1] ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Kills a process by PID (single process only, no tree-kill)
 */
function killProcess(pid: number): boolean {
  try {
    execSync(`taskkill /PID ${pid} /F`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if port is available, optionally kill existing process
 */
export function ensurePortAvailable(port?: number, autoKill = false): void {
  const targetPort = port ?? parseInt(process.env['PORT'] ?? String(DEFAULT_PORT), 10);
  const existingPid = findProcessOnPort(targetPort);

  if (!existingPid) {
    return; // Port is free
  }

  if (autoKill) {
    logger.warn(`Port ${targetPort} in use by PID ${existingPid}, killing...`);
    if (killProcess(existingPid)) {
      logger.info(`Killed process ${existingPid}`);
      // Give it a moment to release the port
      execSync('timeout /t 1 /nobreak >nul', { stdio: 'ignore' });
    } else {
      logger.error(`Failed to kill process ${existingPid}`);
      process.exit(1);
    }
  } else {
    logger.warn(
      `Port ${targetPort} is already in use by PID ${existingPid}. ` +
      `Run: taskkill /PID ${existingPid} /F`
    );
    // Don't exit - let the server try to bind and fail with EADDRINUSE
    // This gives better error handling at the Express level
  }
}

// Legacy exports for backwards compatibility (no-ops)
export function acquireLock(): void {
  // Deprecated - now a no-op
  // Port conflict is handled by Express EADDRINUSE
}

export function releaseLock(): void {
  // Deprecated - now a no-op
}
