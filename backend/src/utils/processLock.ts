import { execFileSync } from 'child_process';
import { logger } from './logger';
import { parseSafeInteger } from './pathSafety';

const DEFAULT_PORT = 3000;
const MAX_PORT = 65535;
const MAX_PID = 4194304;

/**
 * Finds the PID of the process using a given port (Windows-only).
 * Uses execFileSync to avoid shell interpolation.
 */
function findProcessOnPort(port: number): number | null {
  try {
    const result = execFileSync(
      'cmd.exe',
      ['/c', 'netstat', '-ano'],
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    const portStr = `:${port}`;
    const match = result
      .split('\n')
      .find((line) => line.includes(portStr) && line.includes('LISTENING'));

    if (!match) return null;

    const pidMatch = match.trim().match(/\s+(\d+)\s*$/);
    const pid = pidMatch?.[1] ? parseInt(pidMatch[1], 10) : null;

    if (pid !== null && (pid < 1 || pid > MAX_PID)) return null;
    return pid;
  } catch {
    return null;
  }
}

/**
 * Kills a process by PID (single process only, no tree-kill).
 * PID is validated as a safe integer before execution.
 */
function killProcess(pid: number): boolean {
  if (!Number.isInteger(pid) || pid < 1 || pid > MAX_PID) {
    return false;
  }
  try {
    execFileSync(
      'taskkill',
      ['/PID', String(pid), '/F'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if port is available, optionally kill existing process
 */
export function ensurePortAvailable(port?: number, autoKill = false): void {
  const rawPort = port ?? parseInt(process.env['PORT'] ?? String(DEFAULT_PORT), 10);
  const targetPort = parseSafeInteger(rawPort, 1, MAX_PORT);

  if (targetPort === null) {
    logger.error(`Invalid port number: ${rawPort}`);
    return;
  }

  const existingPid = findProcessOnPort(targetPort);

  if (!existingPid) {
    return; // Port is free
  }

  if (autoKill) {
    logger.warn(`Port ${targetPort} in use by PID ${existingPid}, killing...`);
    if (killProcess(existingPid)) {
      logger.info(`Killed process ${existingPid}`);
      // Give it a moment to release the port
      execFileSync('cmd.exe', ['/c', 'timeout', '/t', '1', '/nobreak'], {
        stdio: 'ignore',
      });
    } else {
      logger.error(`Failed to kill process ${existingPid}`);
      process.exit(1);
    }
  } else {
    logger.warn(
      `Port ${targetPort} is already in use by PID ${existingPid}. ` +
      `Run: taskkill /PID ${existingPid} /F`
    );
  }
}

// Legacy exports for backwards compatibility (no-ops)
export function acquireLock(): void {
  // Deprecated - now a no-op
}

export function releaseLock(): void {
  // Deprecated - now a no-op
}
