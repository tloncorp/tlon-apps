import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import {
  JsonObjectSchema,
  JsonSchema,
  SURFACE_JSON_MAX_DEPTH,
  isJson,
  isJsonObject,
  jsonByteLength,
} from '../client/surface/json';

function nest(depth: number, leaf: unknown): unknown {
  let value = leaf;
  for (let i = 0; i < depth; i++) {
    value = { k: value };
  }
  return value;
}

describe('isJson', () => {
  test('accepts scalars, arrays, and plain objects', () => {
    for (const value of [
      null,
      true,
      false,
      0,
      -1.5,
      'text',
      '',
      [],
      {},
      [1, 'two', null, { three: [4] }],
      { a: { b: { c: 'd' } } },
    ]) {
      expect(isJson(value)).toBe(true);
    }
  });

  test('rejects non-JSON runtime values', () => {
    for (const value of [
      undefined,
      NaN,
      Infinity,
      -Infinity,
      42n,
      Symbol('x'),
      () => 0,
      new Date(),
      new Map(),
      new Set(),
      { nested: undefined },
      [NaN],
    ]) {
      expect(isJson(value)).toBe(false);
    }
  });

  test('rejects prototype-polluting keys anywhere in the tree', () => {
    expect(isJson(JSON.parse('{"__proto__": 1}'))).toBe(false);
    expect(isJson({ a: { constructor: 1 } })).toBe(false);
    expect(isJson({ a: [{ prototype: null }] })).toBe(false);
  });

  test('enforces the depth cap at the boundary', () => {
    expect(isJson(nest(SURFACE_JSON_MAX_DEPTH, 'leaf'))).toBe(true);
    expect(isJson(nest(SURFACE_JSON_MAX_DEPTH + 1, 'leaf'))).toBe(false);
    // arrays count toward depth too
    expect(isJson(nest(SURFACE_JSON_MAX_DEPTH - 1, ['leaf']))).toBe(true);
    expect(isJson(nest(SURFACE_JSON_MAX_DEPTH, ['leaf']))).toBe(false);
  });

  test('property: any JSON.parse output within depth bounds validates', () => {
    fc.assert(
      fc.property(
        fc.jsonValue({ maxDepth: SURFACE_JSON_MAX_DEPTH - 1 }),
        (value) => {
          // fast-check jsonValue generates JSON-representable values; the
          // only extra constraints we add are depth (bounded here) and
          // forbidden keys.
          const hasForbiddenKey = /"(__proto__|constructor|prototype)":/.test(
            JSON.stringify(value)
          );
          if (!hasForbiddenKey) {
            expect(isJson(value)).toBe(true);
          }
        }
      )
    );
  });
});

describe('zod schemas', () => {
  test('JsonSchema accepts values and JsonObjectSchema requires objects', () => {
    expect(JsonSchema.safeParse([1, 2, 3]).success).toBe(true);
    expect(JsonObjectSchema.safeParse([1, 2, 3]).success).toBe(false);
    expect(JsonObjectSchema.safeParse({ a: 1 }).success).toBe(true);
    expect(JsonObjectSchema.safeParse('nope').success).toBe(false);
    expect(JsonObjectSchema.safeParse(null).success).toBe(false);
    expect(JsonSchema.safeParse({ a: undefined }).success).toBe(false);
  });

  test('isJsonObject mirrors the schema', () => {
    expect(isJsonObject({})).toBe(true);
    expect(isJsonObject([])).toBe(false);
    expect(isJsonObject(null)).toBe(false);
    expect(isJsonObject({ a: NaN })).toBe(false);
  });
});

describe('jsonByteLength', () => {
  test('measures UTF-8 bytes of the serialization', () => {
    expect(jsonByteLength({})).toBe(2);
    expect(jsonByteLength('ab')).toBe(4); // "ab" with quotes
    expect(jsonByteLength('é')).toBe(4); // 2-byte char plus quotes
  });
});
