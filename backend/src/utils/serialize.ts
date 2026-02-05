/**
 * Converts BigInt fields to Number for JSON serialization.
 * Prisma returns BigInt for certain DB columns, which JSON.stringify cannot handle natively.
 */
export function serializeBigIntFields(obj: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
