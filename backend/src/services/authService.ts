import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import {
  JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY,
  BCRYPT_ROUNDS,
} from '../utils/authConstants';
import type { AccessTokenPayload } from '../types/express';

function getJwtSecret(): string {
  return process.env['JWT_SECRET']!;
}

function getRefreshSecret(): string {
  return process.env['JWT_REFRESH_SECRET']!;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateAccessToken(payload: AccessTokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, getJwtSecret(), options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
}

export async function createRefreshToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(token);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parseDaysFromExpiry(JWT_REFRESH_EXPIRY));

  await prisma.refreshToken.create({
    data: {
      token_hash: tokenHash,
      user_id: userId,
      expires_at: expiresAt,
    },
  });

  return token;
}

export async function rotateRefreshToken(
  oldToken: string
): Promise<{ userId: number; newToken: string } | null> {
  const oldHash = hashToken(oldToken);

  const existing = await prisma.refreshToken.findUnique({
    where: { token_hash: oldHash },
  });

  if (!existing) {
    return null;
  }

  if (existing.revoked_at) {
    await revokeAllUserTokens(existing.user_id);
    return null;
  }

  if (existing.expires_at < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revoked_at: new Date() },
  });

  const newToken = await createRefreshToken(existing.user_id);
  return { userId: existing.user_id, newToken };
}

export async function revokeAllUserTokens(userId: number): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function generateTokenPair(user: {
  id: number;
  email: string;
  role: string;
}): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: AccessTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = await createRefreshToken(user.id);

  return { accessToken, refreshToken };
}

function parseDaysFromExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)d$/);
  return match?.[1] ? parseInt(match[1], 10) : 7;
}
