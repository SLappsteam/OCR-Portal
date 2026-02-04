import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { ROLE_HIERARCHY } from '../utils/authConstants';

const GLOBAL_ACCESS_THRESHOLD = ROLE_HIERARCHY['finance_admin'] ?? 2;

export async function storeScope(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      req.accessibleStoreIds = [];
      next();
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] ?? -1;

    if (userLevel >= GLOBAL_ACCESS_THRESHOLD) {
      req.accessibleStoreIds = null;
      next();
      return;
    }

    const storeAccess = await prisma.userStoreAccess.findMany({
      where: { user_id: req.user.userId, can_view: true },
      select: { store_id: true },
    });

    req.accessibleStoreIds = storeAccess.map((sa) => sa.store_id);
    next();
  } catch (error) {
    next(error);
  }
}
