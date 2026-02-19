import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const scorecardQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

describe('loginSchema', () => {
  it('should accept valid credentials', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'secret123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com' }).success).toBe(false);
  });
});

describe('scorecardQuerySchema', () => {
  it('should accept valid YYYY-MM-DD dates', () => {
    const result = scorecardQuerySchema.safeParse({ date: '2025-01-15' });
    expect(result.success).toBe(true);
  });

  it('should reject invalid date formats', () => {
    expect(scorecardQuerySchema.safeParse({ date: '01-15-2025' }).success).toBe(false);
    expect(scorecardQuerySchema.safeParse({ date: '2025/01/15' }).success).toBe(false);
    expect(scorecardQuerySchema.safeParse({ date: 'not-a-date' }).success).toBe(false);
  });
});
