import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import {
  verifyPassword,
  generateTokenPair,
  rotateRefreshToken,
  revokeAllUserTokens,
} from '../services/authService';
import { authenticate } from '../middleware/authenticate';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_MAX_AGE_MS,
} from '../utils/authConstants';
import { logger } from '../utils/logger';

const router = Router();

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    if (user.auth_provider !== 'local' || !user.password_hash) {
      res.status(401).json({
        success: false,
        error: 'This account uses SSO. Please sign in with Microsoft.',
      });
      return;
    }

    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
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
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const oldToken = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!oldToken) {
      res.status(401).json({ success: false, error: 'No refresh token' });
      return;
    }

    const result = await rotateRefreshToken(oldToken);

    if (!result) {
      clearRefreshCookie(res);
      res.status(401).json({ success: false, error: 'Invalid refresh token' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
    });

    if (!user || !user.is_active) {
      clearRefreshCookie(res);
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    const { accessToken, refreshToken } = await generateTokenPair(user);

    setRefreshCookie(res, refreshToken);

    res.json({ success: true, data: { accessToken } });
  } catch (error) {
    logger.error('Refresh error:', error);
    res.status(500).json({ success: false, error: 'Token refresh failed' });
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await revokeAllUserTokens(req.user!.userId);
    clearRefreshCookie(res);
    logger.info(`User logged out: ${req.user!.email}`);
    res.json({ success: true, data: { message: 'Logged out' } });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
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
      res.status(404).json({ success: false, error: 'User not found' });
      return;
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
    logger.error('Fetch user error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

export default router;
