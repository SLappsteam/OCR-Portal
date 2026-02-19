import { describe, it, expect, vi } from 'vitest';
import { requestId } from '../requestId';
import type { Request, Response, NextFunction } from 'express';

function mockReqRes(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as Request;
  const resHeaders: Record<string, string> = {};
  const res = {
    setHeader: vi.fn((key: string, value: string) => {
      resHeaders[key] = value;
    }),
  } as unknown as Response;
  const next: NextFunction = vi.fn();
  return { req, res, next, resHeaders };
}

describe('requestId middleware', () => {
  it('should generate a UUID when no X-Request-ID header is present', () => {
    const { req, res, next } = mockReqRes();
    requestId(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('should use existing X-Request-ID header when present', () => {
    const { req, res, next } = mockReqRes({
      'x-request-id': 'proxy-generated-id-123',
    });
    requestId(req, res, next);

    expect(req.requestId).toBe('proxy-generated-id-123');
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      'proxy-generated-id-123'
    );
    expect(next).toHaveBeenCalled();
  });
});
