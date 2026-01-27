import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { routes } from './routes';
import { startWatcher, stopWatcher } from './services/watcherService';
import { ensureStorageDirectories } from './services/storageService';

dotenv.config();

const app: Application = express();
const PORT = process.env['PORT'] ?? 3000;
const WATCH_FOLDER_PATH = process.env['WATCH_FOLDER_PATH'] ?? './watch';

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
  stopWatcher();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  startup().catch((err) => {
    logger.error('Startup error:', err);
  });
});

export default app;
