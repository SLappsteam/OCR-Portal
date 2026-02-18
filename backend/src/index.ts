import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Server } from 'http';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';
import { routes } from './routes';
import { startWatcher, stopWatcher } from './services/watcherService';
import { ensureStorageDirectories } from './services/storageService';
import { recoverStuckBatches } from './services/batchRecovery';
import { acquireLock, releaseLock } from './utils/processLock';
import { shutdownOcrPool } from './services/ocrPool';
import { disconnectPrisma } from './utils/prisma';
import { validateAuthEnvironment } from './utils/authConstants';
import cookieParser from 'cookie-parser';

const ENVIRONMENT = process.env['ENVIRONMENT'] ?? 'development';
dotenv.config({ path: `.env.${ENVIRONMENT}` });
dotenv.config(); // fallback: fills any vars not set by the environment-specific file

console.log(`[startup] ENVIRONMENT=${ENVIRONMENT}, NODE_ENV=${process.env['NODE_ENV'] ?? 'undefined'}`);
validateAuthEnvironment();

acquireLock();

const app: Application = express();
const PORT = process.env['PORT'] ?? 3000;
const WATCH_FOLDER_PATH = process.env['WATCH_FOLDER_PATH'] ?? './watch';

let server: Server | null = null;

app.use(helmet());
app.use(cors({
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(generalLimiter);

app.use('/', routes);

app.use(errorHandler);

async function startup(): Promise<void> {
  await ensureStorageDirectories();
  await recoverStuckBatches();
  startWatcher(WATCH_FOLDER_PATH);
}

async function shutdown(): Promise<void> {
  logger.info('Shutting down gracefully...');
  releaseLock();
  stopWatcher();
  await shutdownOcrPool();
  await disconnectPrisma();

  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      logger.warn('Forcing shutdown after timeout');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  startup().catch((err) => {
    logger.error('Startup error:', err);
  });
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Please stop the existing process or use a different port.`);
    process.exit(1);
  }
  throw err;
});

export default app;
