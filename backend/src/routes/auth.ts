import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import {
  verifyPassword,
  generateTokenPair,
  rotateRefreshToken,
  revokeAllUserTokens,
} from '../services/authService';
import { authenticate } from '../middleware/authenticate';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../middleware/errorHandler';
import { REFRESH_COOKIE_NAME } from '../utils/authConstants';
import { setRefreshCookie, clearRefreshCookie } from '../utils/cookieHelpers';
import { logger } from '../utils/logger';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new BadRequestError(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.is_active) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.auth_provider !== 'local' || !user.password_hash) {
      throw new UnauthorizedError('This account uses SSO. Please sign in with Microsoft.');
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const { accessToken, refreshToken } = await generateTokenPair(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    setRefreshCookie(res, refreshToken);
    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const oldToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!oldToken) {
      throw new UnauthorizedError('No refresh token');
    }

    const result = await rotateRefreshToken(oldToken);
    if (!result) {
      clearRefreshCookie(res);
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
    });

    if (!user || !user.is_active) {
      clearRefreshCookie(res);
      throw new UnauthorizedError('User not found');
    }

    const { accessToken, refreshToken } = await generateTokenPair(user);
    setRefreshCookie(res, refreshToken);

    res.json({ success: true, data: { accessToken } });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeAllUserTokens(req.user!.userId);
    clearRefreshCookie(res);
    logger.info(`User logged out: ${req.user!.email}`);
    res.json({ success: true, data: { message: 'Logged out' } });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        last_login_at: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        lastLoginAt: user.last_login_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
