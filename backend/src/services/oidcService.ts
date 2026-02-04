import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

interface OidcConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

interface OidcTokenResponse {
  id_token: string;
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface IdTokenClaims {
  sub: string;
  oid: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  nonce?: string;
}

interface GraphMeResponse {
  department?: string;
  displayName?: string;
  mail?: string;
}

export async function getOidcConfig(): Promise<OidcConfig> {
  const [tenantRow, clientRow] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: 'oidc_tenant_id' } }),
    prisma.appSetting.findUnique({ where: { key: 'oidc_client_id' } }),
  ]);

  const tenantId = tenantRow?.value;
  const clientId = clientRow?.value;
  const clientSecret = process.env['ENTRA_CLIENT_SECRET'];

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('OIDC configuration is incomplete');
  }

  return { tenantId, clientId, clientSecret };
}

export async function isOidcEnabled(): Promise<boolean> {
  const row = await prisma.appSetting.findUnique({
    where: { key: 'oidc_enabled' },
  });
  return row?.value === 'true';
}

export function buildAuthorizationUrl(
  config: OidcConfig,
  state: string,
  nonce: string,
  redirectUri: string
): string {
  const base = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`;
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email User.Read',
    state,
    nonce,
    response_mode: 'query',
  });
  return `${base}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  config: OidcConfig,
  code: string,
  redirectUri: string
): Promise<OidcTokenResponse> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: 'openid profile email User.Read',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('OIDC token exchange failed', { status: response.status, body: errorText });
    throw new Error('Failed to exchange authorization code for tokens');
  }

  return response.json() as Promise<OidcTokenResponse>;
}

export async function validateIdToken(
  config: OidcConfig,
  idToken: string,
  nonce: string
): Promise<IdTokenClaims> {
  const jwksUrl = `https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`;
  const jwks = createRemoteJWKSet(new URL(jwksUrl));
  const issuer = `https://login.microsoftonline.com/${config.tenantId}/v2.0`;

  const { payload } = await jwtVerify(idToken, jwks, {
    audience: config.clientId,
    issuer,
  });

  if (payload['nonce'] !== nonce) {
    throw new Error('ID token nonce mismatch');
  }

  return {
    sub: payload.sub as string,
    oid: (payload['oid'] as string) ?? payload.sub!,
    email: payload['email'] as string | undefined,
    preferred_username: payload['preferred_username'] as string | undefined,
    name: payload['name'] as string | undefined,
    nonce: payload['nonce'] as string | undefined,
  };
}

export async function fetchUserProfile(
  accessToken: string
): Promise<GraphMeResponse> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    logger.warn('Failed to fetch Graph /me profile', { status: response.status });
    return {};
  }

  return response.json() as Promise<GraphMeResponse>;
}

export function parseStoreFromDepartment(
  department: string | undefined
): string | null {
  if (!department) return null;
  const match = department.match(/^ST(\d+)/i);
  return match?.[1] ?? null;
}

export function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}
