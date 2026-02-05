import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/authService';
import { logger } from '../utils/logger';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

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

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const queryToken = req.query['token'];
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }

  return null;
}
