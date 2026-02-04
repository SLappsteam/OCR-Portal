import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ApiResponse } from '../types';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const documentTypes = await prisma.documentType.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });

    const response: ApiResponse = { success: true, data: documentTypes };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
