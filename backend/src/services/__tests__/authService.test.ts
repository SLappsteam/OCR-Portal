import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment before importing the module
vi.stubEnv('JWT_SECRET', 'test-secret-key-for-vitest');
vi.stubEnv('JWT_REFRESH_SECRET', 'test-refresh-secret-for-vitest');

// Mock prisma
vi.mock('../../utils/prisma', () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
} from '../authService';

describe('password hashing', () => {
  it('should hash and verify a password', async () => {
    const plain = 'mySecret123!';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const isValid = await verifyPassword('wrong-password', hash);
    expect(isValid).toBe(false);
  });
});

describe('JWT access tokens', () => {
  it('should generate and verify a token', () => {
    const payload = { userId: 42, email: 'test@example.com', role: 'admin' };
    const token = generateAccessToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(42);
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('admin');
  });

  it('should reject tampered tokens', () => {
    const payload = { userId: 1, email: 'a@b.com', role: 'viewer' };
    const token = generateAccessToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';

    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('should reject garbage strings', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow();
  });
});
