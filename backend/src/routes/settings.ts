import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import { prisma } from '../utils/prisma';
import { clearStorageFiles } from '../services/storageService';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

interface SettingsResponse {
  watchFolderPath: string;
  storagePath: string;
  archivePath: string;
  watcherStatus: 'running' | 'stopped';
}

let watcherRunning = false;

export function setWatcherStatus(running: boolean): void {
  watcherRunning = running;
}

router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    const watchFolder = process.env['WATCH_FOLDER_PATH'] ?? './watch';
    const storage = process.env['TIFF_STORAGE_PATH'] ?? './storage/tiffs';
    const archive = process.env['ARCHIVE_FOLDER_PATH'] ?? './storage/archive';

    const settings: SettingsResponse = {
      watchFolderPath: path.resolve(watchFolder),
      storagePath: path.resolve(storage),
      archivePath: path.resolve(archive),
      watcherStatus: watcherRunning ? 'running' : 'stopped',
    };

    const response: ApiResponse<SettingsResponse> = {
      success: true,
      data: settings,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/clear-data', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const deletedDocs = await prisma.document.deleteMany({});
    const deletedBatches = await prisma.batch.deleteMany({});
    await clearStorageFiles();

    logger.info(`Cleared data: ${deletedDocs.count} documents, ${deletedBatches.count} batches, storage files removed`);

    const response: ApiResponse<{ documents: number; batches: number }> = {
      success: true,
      data: {
        documents: deletedDocs.count,
        batches: deletedBatches.count,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
