// Converts between Postgres's snake_case columns and this app's camelCase
// TypeScript types, so query functions can stay short and declarative.

function toCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export function rowToCamel<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v;
  }
  return out as T;
}

export function rowsToCamel<T>(rows: Record<string, any>[]): T[] {
  return rows.map((r) => rowToCamel<T>(r));
}

export function objToSnake(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[toSnake(k)] = v;
  }
  return out;
}
