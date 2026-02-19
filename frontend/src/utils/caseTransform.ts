function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamel<T>(data: unknown): T {
  if (data === null || data === undefined) return data as T;
  if (Array.isArray(data)) return data.map((item) => snakeToCamel(item)) as T;
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[toCamelCase(key)] = snakeToCamel(obj[key]);
    }
    return result as T;
  }
  return data as T;
}

export function camelToSnake<T>(data: unknown): T {
  if (data === null || data === undefined) return data as T;
  if (Array.isArray(data)) return data.map((item) => camelToSnake(item)) as T;
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      result[toSnakeCase(key)] = camelToSnake(obj[key]);
    }
    return result as T;
  }
  return data as T;
}
