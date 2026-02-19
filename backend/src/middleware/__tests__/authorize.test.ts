import { describe, it, expect, vi } from 'vitest';
import { requireRole, requireMinimumRole } from '../authorize';
import type { Request, Response, NextFunction } from 'express';

function mockReqRes(role?: string) {
  const req = { user: role ? { userId: 1, email: 'a@b.com', role } : undefined } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next: NextFunction = vi.fn();
  return { req, res, next };
}

describe('requireRole', () => {
  it('should allow matching role', () => {
    const { req, res, next } = mockReqRes('admin');
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow any of multiple roles', () => {
    const { req, res, next } = mockReqRes('manager');
    requireRole('admin', 'manager')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject non-matching role', () => {
    const { req, res, next } = mockReqRes('viewer');
    requireRole('admin')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should reject when no user is set', () => {
    const { req, res, next } = mockReqRes();
    requireRole('admin')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requireMinimumRole', () => {
  it('should allow admin for any minimum', () => {
    const { req, res, next } = mockReqRes('admin');
    requireMinimumRole('viewer')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow exact match', () => {
    const { req, res, next } = mockReqRes('manager');
    requireMinimumRole('manager')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject lower role', () => {
    const { req, res, next } = mockReqRes('viewer');
    requireMinimumRole('manager')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should follow role hierarchy: viewer < operator < finance_admin < manager < admin', () => {
    const roles = ['viewer', 'operator', 'finance_admin', 'manager', 'admin'];
    for (let i = 0; i < roles.length; i++) {
      for (let j = 0; j < roles.length; j++) {
        const { req, res, next } = mockReqRes(roles[i]);
        requireMinimumRole(roles[j]!)(req, res, next);
        if (i >= j) {
          expect(next).toHaveBeenCalled();
        } else {
          expect(next).not.toHaveBeenCalled();
        }
      }
    }
  });
});
