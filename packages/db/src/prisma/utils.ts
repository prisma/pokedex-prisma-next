import type { PlainObject } from "./metadata";

export function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }
  if (isPlainObject(value)) {
    return normalizeRecord(value);
  }
  return value;
}

export function normalizeRecord(value: PlainObject): PlainObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)]),
  );
}
