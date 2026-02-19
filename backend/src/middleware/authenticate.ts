import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyAccessToken } from '../services/authService';
import { REFRESH_COOKIE_NAME } from '../utils/authConstants';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = extractBearerToken(req);

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

/**
 * Preview-specific auth: accepts Bearer header OR falls back to the
 * refresh_token cookie so `<img src="/api/preview/...">` works without
 * putting a JWT in the URL.
 */
export async function authenticatePreview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // 1. Try Bearer header first (API calls from JS)
  const bearerToken = extractBearerToken(req);
  if (bearerToken) {
    try {
      req.user = verifyAccessToken(bearerToken);
      next();
      return;
    } catch {
      // fall through to cookie
    }
  }

  // 2. Fall back to refresh_token cookie (browser <img> requests)
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  try {
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const record = await prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: { select: { id: true, email: true, role: true, is_active: true } } },
    });

    if (
      !record ||
      record.revoked_at ||
      record.expires_at < new Date() ||
      !record.user.is_active
    ) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      userId: record.user.id,
      email: record.user.email,
      role: record.user.role,
    };
    next();
  } catch {
    logger.debug('Preview cookie auth failed');
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
