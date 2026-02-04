export const JWT_ACCESS_EXPIRY = process.env['JWT_ACCESS_EXPIRY'] ?? '15m';
export const JWT_REFRESH_EXPIRY = process.env['JWT_REFRESH_EXPIRY'] ?? '7d';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const BCRYPT_ROUNDS = 12;

export const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  operator: 1,
  finance_admin: 2,
  manager: 3,
  admin: 4,
};

export function validateAuthEnvironment(): void {
  if (!process.env['JWT_SECRET']) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (!process.env['JWT_REFRESH_SECRET']) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }
}
