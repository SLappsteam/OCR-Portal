import { describe, it, expect } from 'vitest';
import { hasMinimumRole, ROLE_HIERARCHY } from '../roleUtils';

describe('ROLE_HIERARCHY', () => {
  it('should define all five roles', () => {
    expect(Object.keys(ROLE_HIERARCHY)).toEqual(
      expect.arrayContaining(['viewer', 'operator', 'finance_admin', 'manager', 'admin'])
    );
  });

  it('should have ascending numeric levels', () => {
    expect(ROLE_HIERARCHY['viewer']).toBeLessThan(ROLE_HIERARCHY['operator']!);
    expect(ROLE_HIERARCHY['operator']).toBeLessThan(ROLE_HIERARCHY['finance_admin']!);
    expect(ROLE_HIERARCHY['finance_admin']).toBeLessThan(ROLE_HIERARCHY['manager']!);
    expect(ROLE_HIERARCHY['manager']).toBeLessThan(ROLE_HIERARCHY['admin']!);
  });
});

describe('hasMinimumRole', () => {
  it('should return true when user has exact role', () => {
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
    expect(hasMinimumRole('viewer', 'viewer')).toBe(true);
  });

  it('should return true when user has higher role', () => {
    expect(hasMinimumRole('admin', 'viewer')).toBe(true);
    expect(hasMinimumRole('manager', 'operator')).toBe(true);
  });

  it('should return false when user has lower role', () => {
    expect(hasMinimumRole('viewer', 'admin')).toBe(false);
    expect(hasMinimumRole('operator', 'manager')).toBe(false);
  });

  it('should return false for unknown user roles', () => {
    expect(hasMinimumRole('unknown_role', 'viewer')).toBe(false);
  });
});
