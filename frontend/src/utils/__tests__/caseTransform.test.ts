import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake } from '../caseTransform';

describe('snakeToCamel', () => {
  it('converts flat object keys', () => {
    expect(snakeToCamel({ user_name: 'John', last_login_at: '2025-01-01' })).toEqual({
      userName: 'John',
      lastLoginAt: '2025-01-01',
    });
  });

  it('converts nested objects', () => {
    expect(
      snakeToCamel({ user: { first_name: 'John', store_access: [{ can_view: true }] } })
    ).toEqual({ user: { firstName: 'John', storeAccess: [{ canView: true }] } });
  });

  it('handles arrays', () => {
    expect(snakeToCamel([{ batch_id: 1 }, { batch_id: 2 }])).toEqual([
      { batchId: 1 },
      { batchId: 2 },
    ]);
  });

  it('handles null and undefined', () => {
    expect(snakeToCamel(null)).toBeNull();
    expect(snakeToCamel(undefined)).toBeUndefined();
  });

  it('passes through primitives', () => {
    expect(snakeToCamel(42)).toBe(42);
    expect(snakeToCamel('hello')).toBe('hello');
    expect(snakeToCamel(true)).toBe(true);
  });

  it('handles keys without underscores', () => {
    expect(snakeToCamel({ name: 'test', id: 1 })).toEqual({ name: 'test', id: 1 });
  });
});

describe('camelToSnake', () => {
  it('converts flat object keys', () => {
    expect(camelToSnake({ userName: 'John', lastLoginAt: '2025-01-01' })).toEqual({
      user_name: 'John',
      last_login_at: '2025-01-01',
    });
  });

  it('converts nested objects', () => {
    expect(
      camelToSnake({ user: { firstName: 'John', storeAccess: [{ canView: true }] } })
    ).toEqual({ user: { first_name: 'John', store_access: [{ can_view: true }] } });
  });

  it('handles null and undefined', () => {
    expect(camelToSnake(null)).toBeNull();
    expect(camelToSnake(undefined)).toBeUndefined();
  });

  it('roundtrips correctly', () => {
    const original = { store_number: '123', batch_count: 5, is_active: true };
    expect(camelToSnake(snakeToCamel(original))).toEqual(original);
  });
});
