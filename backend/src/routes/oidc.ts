import { Router, Request, Response } from 'express';
import {
  isOidcEnabled,
  getOidcConfig,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  validateIdToken,
  fetchUserProfile,
  generateNonce,
  generateState,
} from '../services/oidcService';
import { findOrCreateOidcUser } from '../services/oidcUserService';
import { generateTokenPair } from '../services/authService';
import { encryptState, decryptState } from '../utils/oidcCrypto';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_MAX_AGE_MS,
} from '../utils/authConstants';
import { logger } from '../utils/logger';

const router = Router();

const OIDC_STATE_COOKIE = 'oidc_state';
const STATE_TTL_MS = 5 * 60 * 1000;

function getRedirectUri(req: Request): string {
  const baseUrl = process.env['BACKEND_URL']
    ?? `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/api/auth/oidc/callback`;
}

router.get('/config', async (_req: Request, res: Response) => {
  try {
    const enabled = await isOidcEnabled();
    res.json({ success: true, data: { enabled } });
  } catch {
    res.json({ success: true, data: { enabled: false } });
  }
});

router.get('/authorize', async (req: Request, res: Response) => {
  try {
    const enabled = await isOidcEnabled();
    if (!enabled) {
      res.status(404).json({ success: false, error: 'OIDC is not enabled' });
      return;
    }

    const config = await getOidcConfig();
    const state = generateState();
    const nonce = generateNonce();
    const redirectUri = getRedirectUri(req);

    const encrypted = encryptState({
      state,
      nonce,
      timestamp: Date.now(),
    });

    res.cookie(OIDC_STATE_COOKIE, encrypted, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_TTL_MS,
    });

    const authUrl = buildAuthorizationUrl(config, state, nonce, redirectUri);
    res.redirect(302, authUrl);
  } catch (error) {
    logger.error('OIDC authorize error:', error);
    res.redirect('/login?error=oidc_config');
  }
});

router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error: oidcError } = req.query;

    if (oidcError) {
      logger.warn('OIDC callback error from provider', { error: oidcError });
      res.redirect(`/login?error=${encodeURIComponent(String(oidcError))}`);
      return;
    }

    if (!code || !state) {
      res.redirect('/login?error=missing_params');
      return;
    }

    const stateCookie = req.cookies?.[OIDC_STATE_COOKIE];
    if (!stateCookie) {
      res.redirect('/login?error=expired_state');
      return;
    }

    res.clearCookie(OIDC_STATE_COOKIE, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
    });

    const stateData = decryptState(stateCookie);
    if (stateData['state'] !== state) {
      res.redirect('/login?error=invalid_state');
      return;
    }

    const elapsed = Date.now() - (stateData['timestamp'] as number);
    if (elapsed > STATE_TTL_MS) {
      res.redirect('/login?error=expired_state');
      return;
    }

    const config = await getOidcConfig();
    const redirectUri = getRedirectUri(req);

    const tokens = await exchangeCodeForTokens(
      config,
      String(code),
      redirectUri
    );

    const claims = await validateIdToken(
      config,
      tokens.id_token,
      stateData['nonce'] as string
    );

    const profile = await fetchUserProfile(tokens.access_token);
    const user = await findOrCreateOidcUser(claims, profile.department);

    if (!user.is_active) {
      res.redirect('/login?error=account_disabled');
      return;
    }

    const { accessToken, refreshToken } = await generateTokenPair(user);

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    logger.info(`OIDC login successful: ${user.email}`);
    res.redirect(`/login?oidc=success&token=${accessToken}`);
  } catch (error) {
    logger.error('OIDC callback error:', error);
    res.redirect('/login?error=oidc_failed');
  }
});

export default router;
