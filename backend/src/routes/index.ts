import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import testProcessRouter from './testProcess';
import documentsRouter from './documents';
import batchesRouter from './batches';
import previewRouter from './preview';
import storesRouter from './stores';
import documentTypesRouter from './documentTypes';
import statsRouter from './stats';
import settingsRouter from './settings';
import pageSearchRouter from './pageSearch';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/auth', authRouter);

router.use('/api/test', authenticate, requireRole('admin'), testProcessRouter);
router.use('/api/documents', authenticate, documentsRouter);
router.use('/api/page-search', authenticate, pageSearchRouter);
router.use('/api/batches', authenticate, batchesRouter);
router.use('/api/preview', authenticate, previewRouter);
router.use('/api/stores', authenticate, storesRouter);
router.use('/api/document-types', authenticate, documentTypesRouter);
router.use('/api/stats', authenticate, statsRouter);
router.use('/api/settings', authenticate, requireRole('admin'), settingsRouter);

export { router as routes };
