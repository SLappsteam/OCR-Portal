import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../types';

const router = Router();
const prisma = new PrismaClient();

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
