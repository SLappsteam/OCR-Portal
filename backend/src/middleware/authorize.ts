import { Request, Response, NextFunction } from 'express';
import { ROLE_HIERARCHY } from '../utils/authConstants';

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

export function requireMinimumRole(minimumRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    const userLevel = userRole ? (ROLE_HIERARCHY[userRole] ?? -1) : -1;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}
