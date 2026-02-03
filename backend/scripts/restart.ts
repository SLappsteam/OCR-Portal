/**
 * Safe restart script - kills only the process on the target port, not the tree
 */
import { execSync } from 'child_process';

const PORT: string = process.env['PORT'] ?? '3000';

function findProcessOnPort(port: string): number | null {
  try {
    const result = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const match = result.trim().split('\n')[0]?.match(/\s+(\d+)\s*$/);
    return match?.[1] ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

const pid = findProcessOnPort(PORT);

if (pid) {
  console.log(`Killing process ${pid} on port ${PORT}...`);
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit' });
    console.log('Process killed. Waiting for port release...');
    execSync('timeout /t 2 /nobreak >nul', { stdio: 'ignore' });
  } catch (err) {
    console.error('Failed to kill process:', err);
    process.exit(1);
  }
} else {
  console.log(`No process found on port ${PORT}`);
}

console.log('Starting server...');
