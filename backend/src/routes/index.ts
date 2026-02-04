import { Router } from 'express';
import healthRouter from './health';
import authRouter from './auth';
import oidcRouter from './oidc';
import testProcessRouter from './testProcess';
import documentsRouter from './documents';
import batchesRouter from './batches';
import previewRouter from './preview';
import storesRouter from './stores';
import documentTypesRouter from './documentTypes';
import statsRouter from './stats';
import settingsRouter from './settings';
import pageSearchRouter from './pageSearch';
import usersRouter from './users';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/authorize';
import { storeScope } from '../middleware/storeScope';
import { ocrLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/auth', authRouter);
router.use('/api/auth/oidc', oidcRouter);

router.post('/api/test/analyze-tiff', ocrLimiter);
router.post('/api/batches/:id/reprocess', ocrLimiter);

router.use('/api/test', authenticate, requireRole('admin'), testProcessRouter);
router.use('/api/documents', authenticate, storeScope, documentsRouter);
router.use('/api/page-search', authenticate, storeScope, pageSearchRouter);
router.use('/api/batches', authenticate, storeScope, batchesRouter);
router.use('/api/preview', authenticate, storeScope, previewRouter);
router.use('/api/stores', authenticate, storesRouter);
router.use('/api/document-types', authenticate, documentTypesRouter);
router.use('/api/stats', authenticate, storeScope, statsRouter);
router.use('/api/settings', authenticate, requireRole('admin'), settingsRouter);
router.use('/api/users', authenticate, requireRole('admin'), usersRouter);

export { router as routes };
