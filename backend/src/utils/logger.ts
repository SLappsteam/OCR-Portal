import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = process.env['LOG_DIR'] ?? 'logs';
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';

// Human-readable format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const base = `${timestamp} [${level}]: ${message}`;
    return stack ? `${base}\n${stack}` : base;
  })
);

// Structured JSON format for file transport (parseable by log aggregators)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const rotateTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: 5,
  format: jsonFormat,
});

const consoleTransport = new winston.transports.Console({
  format: consoleFormat,
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
