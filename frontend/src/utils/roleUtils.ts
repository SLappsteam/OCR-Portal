export const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  operator: 1,
  manager: 2,
  admin: 3,
};

export function hasMinimumRole(userRole: string, minimumRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] ?? -1;
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0;
  return userLevel >= requiredLevel;
}
