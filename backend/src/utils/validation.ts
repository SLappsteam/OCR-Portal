import { z } from 'zod';

export const storeNumberSchema = z
  .string()
  .min(1, 'Store number is required')
  .max(20, 'Store number must be 20 characters or less')
  .regex(/^[A-Za-z0-9-]+$/, 'Store number must be alphanumeric');

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must be 255 characters or less');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID must be a positive integer'),
});

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });

  return { success: false, errors };
}

export function isValidStoreNumber(storeNumber: string): boolean {
  return storeNumberSchema.safeParse(storeNumber).success;
}

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}
