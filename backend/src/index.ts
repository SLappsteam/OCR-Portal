import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Server } from 'http';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { routes } from './routes';
import { startWatcher, stopWatcher } from './services/watcherService';
import { ensureStorageDirectories } from './services/storageService';
import { acquireLock, releaseLock } from './utils/processLock';

dotenv.config();

acquireLock();

const app: Application = express();
const PORT = process.env['PORT'] ?? 3000;
const WATCH_FOLDER_PATH = process.env['WATCH_FOLDER_PATH'] ?? './watch';

let server: Server | null = null;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', routes);

app.use(errorHandler);

async function startup(): Promise<void> {
  await ensureStorageDirectories();
  startWatcher(WATCH_FOLDER_PATH);
}

function shutdown(): void {
  logger.info('Shutting down gracefully...');
  releaseLock();
  stopWatcher();

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
