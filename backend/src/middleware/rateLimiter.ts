import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const GENERAL_WINDOW_MS = 60 * 1000;
const GENERAL_MAX_REQUESTS = 100;

const PREVIEW_PATH_PREFIX = '/api/preview';

const OCR_WINDOW_MS = 60 * 1000;
const OCR_MAX_REQUESTS = 10;

export const generalLimiter = rateLimit({
  windowMs: GENERAL_WINDOW_MS,
  max: GENERAL_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req: Request) => req.path.startsWith(PREVIEW_PATH_PREFIX),
  message: { success: false, error: 'Too many requests, please try again later' },
});

export const ocrLimiter = rateLimit({
  windowMs: OCR_WINDOW_MS,
  max: OCR_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OCR requests, please try again later' },
});
