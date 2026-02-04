import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';
import { logger } from '../utils/logger';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    logger.debug('Invalid access token');
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}
