import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { HealthCheckResponse, ApiResponse } from '../types';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  let databaseStatus: 'connected' | 'disconnected' = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseStatus = 'connected';
  } catch (error) {
    logger.error('Database health check failed:', error);
  }

  const healthData: HealthCheckResponse = {
    status: databaseStatus === 'connected' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database: databaseStatus,
  };

  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: healthData,
  };

  const statusCode = databaseStatus === 'connected' ? 200 : 503;
  res.status(statusCode).json(response);
});

export default router;
