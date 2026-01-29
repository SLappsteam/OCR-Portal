import { Router } from 'express';
import healthRouter from './health';
import testProcessRouter from './testProcess';
import documentsRouter from './documents';
import batchesRouter from './batches';
import previewRouter from './preview';
import storesRouter from './stores';
import documentTypesRouter from './documentTypes';
import statsRouter from './stats';
import settingsRouter from './settings';
import pageSearchRouter from './pageSearch';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/test', testProcessRouter);
router.use('/api/documents', documentsRouter);
router.use('/api/page-search', pageSearchRouter);
router.use('/api/batches', batchesRouter);
router.use('/api/preview', previewRouter);
router.use('/api/stores', storesRouter);
router.use('/api/document-types', documentTypesRouter);
router.use('/api/stats', statsRouter);
router.use('/api/settings', settingsRouter);

export { router as routes };
