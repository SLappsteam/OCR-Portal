/**
 * Builds a Prisma where-clause fragment for store scoping.
 * Returns undefined when storeIds is null (no filter needed — global access).
 * Returns { store_id: { in: storeIds } } when scoped to specific stores.
 */
export function buildStoreWhereClause(
  storeIds: number[] | null | undefined
): { store_id: { in: number[] } } | undefined {
  if (storeIds === null || storeIds === undefined) {
    return undefined;
  }
  return { store_id: { in: storeIds } };
}
