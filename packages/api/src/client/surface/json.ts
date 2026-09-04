import { z } from 'zod';

/**
 * Recursive JSON value types for surface channels.
 *
 * The existing `JSONValue` type is scalar-only and stays untouched; surface
 * state needs full JSON trees. Values are validated structurally rather than
 * by type assertion because every producer is untrusted (blob entries,
 * channel descriptions).
 */
export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type JsonObject = { [key: string]: Json };

/**
 * Maximum container nesting. A value inside more than this many nested
 * arrays/objects is invalid.
 */
export const SURFACE_JSON_MAX_DEPTH = 16;

/**
 * Keys rejected in surface JSON objects. The JSON pointer grammar already
 * forbids these as path segments, so no reducer-reachable state can contain
 * them; rejecting them at validation keeps hostile snapshots/specs from
 * smuggling prototype-polluting keys into code that indexes state objects.
 */
const FORBIDDEN_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

export function isForbiddenObjectKey(key: string): boolean {
  return FORBIDDEN_OBJECT_KEYS.has(key);
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Returns a description of the first violation, or null when `value` is
 * valid surface JSON. `depth` counts enclosing containers.
 */
function findJsonViolation(
  value: unknown,
  depth: number,
  maxDepth: number
): string | null {
  if (value === null) {
    return null;
  }
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return null;
    case 'number':
      return Number.isFinite(value) ? null : 'numbers must be finite';
    case 'object':
      break;
    default:
      return `unsupported value type: ${typeof value}`;
  }
  if (depth >= maxDepth) {
    return `exceeds max depth of ${maxDepth}`;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const violation = findJsonViolation(item, depth + 1, maxDepth);
      if (violation) {
        return violation;
      }
    }
    return null;
  }
  if (!isPlainObject(value)) {
    return 'objects must be plain';
  }
  for (const key of Object.keys(value)) {
    if (isForbiddenObjectKey(key)) {
      return `forbidden object key: ${key}`;
    }
    const violation = findJsonViolation(
      (value as Record<string, unknown>)[key],
      depth + 1,
      maxDepth
    );
    if (violation) {
      return violation;
    }
  }
  return null;
}

export function isJson(value: unknown): value is Json {
  return findJsonViolation(value, 0, SURFACE_JSON_MAX_DEPTH) === null;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    isJson(value)
  );
}

function jsonRefinement(kind: 'value' | 'object') {
  return (value: unknown, ctx: z.RefinementCtx) => {
    if (kind === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'expected a JSON object',
        });
        return;
      }
    }
    const violation = findJsonViolation(value, 0, SURFACE_JSON_MAX_DEPTH);
    if (violation) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: violation });
    }
  };
}

export const JsonSchema: z.ZodType<Json> = z
  .unknown()
  .superRefine(jsonRefinement('value')) as unknown as z.ZodType<Json>;

export const JsonObjectSchema: z.ZodType<JsonObject> = z
  .unknown()
  .superRefine(jsonRefinement('object')) as unknown as z.ZodType<JsonObject>;

/** UTF-8 byte length of a value's JSON serialization, for cap enforcement. */
export function jsonByteLength(value: Json): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/**
 * Container nesting depth: 0 for scalars, 1 + deepest child for
 * arrays/objects. `isJson` admits values with depth ≤ SURFACE_JSON_MAX_DEPTH.
 */
export function jsonContainerDepth(value: Json): number {
  if (Array.isArray(value)) {
    let max = 0;
    for (const item of value) {
      max = Math.max(max, jsonContainerDepth(item));
    }
    return 1 + max;
  }
  if (typeof value === 'object' && value !== null) {
    let max = 0;
    for (const key of Object.keys(value)) {
      max = Math.max(max, jsonContainerDepth(value[key]));
    }
    return 1 + max;
  }
  return 0;
}
