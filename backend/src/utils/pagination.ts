import { z } from 'zod';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

export const cursorPaginationSchema = z.object({
  cursor: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? undefined : parsed;
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return DEFAULT_PAGE_SIZE;
      const parsed = parseInt(val, 10);
      if (isNaN(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
      return Math.min(parsed, MAX_PAGE_SIZE);
    }),
});

export interface CursorPaginationParams {
  cursor: number | undefined;
  limit: number;
}

export function buildCursorWhere(cursor: number | undefined): object {
  if (cursor === undefined) return {};
  return { id: { lt: cursor } };
}

export function extractNextCursor<T extends { id: number }>(
  items: T[],
  limit: number
): number | null {
  if (items.length < limit) return null;
  const lastItem = items[items.length - 1];
  return lastItem ? lastItem.id : null;
}
