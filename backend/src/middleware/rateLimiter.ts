import rateLimit from 'express-rate-limit';

const GENERAL_WINDOW_MS = 60 * 1000;
const GENERAL_MAX_REQUESTS = 100;

const OCR_WINDOW_MS = 60 * 1000;
const OCR_MAX_REQUESTS = 10;

export const generalLimiter = rateLimit({
  windowMs: GENERAL_WINDOW_MS,
  max: GENERAL_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

export const ocrLimiter = rateLimit({
  windowMs: OCR_WINDOW_MS,
  max: OCR_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many OCR requests, please try again later' },
});
