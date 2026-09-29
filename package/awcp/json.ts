import type { JsonObject, JsonValue } from './types';

export class InvalidJsonValueError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJsonValueError';
  }
}

export function cloneJson(value: unknown): JsonValue {
  return cloneJsonAt(value, '$', new WeakSet<object>());
}

export function cloneJsonObject(value: unknown): JsonObject {
  const cloned = cloneJson(value);
  if (!isJsonObject(cloned)) throw new InvalidJsonValueError('Expected a JSON object at $.');
  return cloned;
}

export function isJsonObject(value: unknown): value is JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

export function jsonDepth(value: JsonValue): number {
  if (value === null || typeof value !== 'object') return 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  let maximumChildDepth = 0;
  for (const child of children) maximumChildDepth = Math.max(maximumChildDepth, jsonDepth(child));
  return 1 + maximumChildDepth;
}

export function stableJsonStringify(value: JsonValue): string {
  return JSON.stringify(sortJson(value));
}

export function jsonUtf8Size(value: JsonValue): number {
  return new TextEncoder().encode(stableJsonStringify(value)).byteLength;
}

function cloneJsonAt(value: unknown, path: string, ancestors: WeakSet<object>): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new InvalidJsonValueError(`Non-finite number at ${path}.`);
    return value;
  }
  if (typeof value !== 'object') throw new InvalidJsonValueError(`Non-JSON value at ${path}.`);
  if (ancestors.has(value)) throw new InvalidJsonValueError(`Circular JSON value at ${path}.`);

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length !== value.length || keys.some((key, index) => key !== String(index)))
        throw new InvalidJsonValueError(`Sparse or extended array at ${path}.`);
      if (Object.getOwnPropertySymbols(value).length > 0)
        throw new InvalidJsonValueError(`Symbol property at ${path}.`);
      return value.map((item, index) => cloneJsonAt(item, `${path}[${index}]`, ancestors));
    }
    if (!isJsonObject(value)) throw new InvalidJsonValueError(`Non-plain object at ${path}.`);
    if (Object.getOwnPropertySymbols(value).length > 0) throw new InvalidJsonValueError(`Symbol property at ${path}.`);

    const output: JsonObject = {};
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor))
        throw new InvalidJsonValueError(`Accessor property at ${path}.${key}.`);
      output[key] = cloneJsonAt(descriptor.value, `${path}.${key}`, ancestors);
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

function sortJson(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortJson);
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])])
  );
}
