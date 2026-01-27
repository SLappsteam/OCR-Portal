import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const LOG_DIR = process.env['LOG_DIR'] ?? 'logs';
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const base = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    return stack ? `${base}\n${stack}` : base;
  })
);

const rotateTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: 5,
  format: logFormat,
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    logFormat
  ),
});

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  transports: [
    rotateTransport,
    consoleTransport,
  ],
});

export function sanitizeLogData<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['password', 'token', 'secret', 'apiKey']
): T {
  const sanitized = { ...data };
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      (sanitized as Record<string, unknown>)[field] = '[REDACTED]';
    }
  }
  return sanitized;
}
