import { describe, it, expect } from 'vitest';
import { assertPathContained, parseSafeInteger } from '../pathSafety';

describe('assertPathContained', () => {
  it('should reject empty paths', () => {
    expect(() => assertPathContained('')).toThrow('File path is required');
  });

  it('should reject non-string paths', () => {
    expect(() => assertPathContained(null as unknown as string)).toThrow(
      'File path is required'
    );
  });

  it('should reject UNC paths', () => {
    expect(() => assertPathContained('\\\\server\\share\\file.tif')).toThrow(
      'UNC and remote paths are not allowed'
    );
  });

  it('should reject protocol URLs', () => {
    expect(() => assertPathContained('http://evil.com/file.tif')).toThrow(
      'UNC and remote paths are not allowed'
    );
    expect(() => assertPathContained('ftp://evil.com/file.tif')).toThrow(
      'UNC and remote paths are not allowed'
    );
  });

  it('should reject null byte injection', () => {
    expect(() => assertPathContained('storage/tiffs/file\0.tif')).toThrow(
      'Invalid file path'
    );
  });

  it('should reject paths outside allowed roots', () => {
    expect(() => assertPathContained('/etc/passwd')).toThrow(
      'File path is outside allowed directories'
    );
    expect(() => assertPathContained('C:\\Windows\\System32\\cmd.exe')).toThrow(
      'File path is outside allowed directories'
    );
  });
});

describe('parseSafeInteger', () => {
  it('should parse valid integers', () => {
    expect(parseSafeInteger('3000')).toBe(3000);
    expect(parseSafeInteger('1')).toBe(1);
    expect(parseSafeInteger(8080)).toBe(8080);
  });

  it('should reject non-integer values', () => {
    expect(parseSafeInteger('abc')).toBeNull();
    expect(parseSafeInteger(3.14)).toBeNull();
    expect(parseSafeInteger(NaN)).toBeNull();
  });

  it('should reject out-of-range values', () => {
    expect(parseSafeInteger(0)).toBeNull();
    expect(parseSafeInteger(99999)).toBeNull();
    expect(parseSafeInteger(-1)).toBeNull();
  });

  it('should respect custom min/max', () => {
    expect(parseSafeInteger(5, 1, 10)).toBe(5);
    expect(parseSafeInteger(11, 1, 10)).toBeNull();
    expect(parseSafeInteger(0, 1, 10)).toBeNull();
  });
});
