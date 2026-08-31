import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import type { Json, JsonObject } from '../client/surface/json';
import { isJson } from '../client/surface/json';
import {
  POINTER_MAX_LENGTH,
  POINTER_MAX_SEGMENTS,
  SurfaceOp,
  applyOp,
  escapePointerSegment,
  formatPointer,
  parsePointer,
  unescapePointerSegment,
} from '../client/surface/jsonPointer';

function segmentsOf(path: string): string[] {
  const result = parsePointer(path);
  if (!result.ok) {
    throw new Error(`expected ${path} to parse: ${result.error}`);
  }
  return result.segments;
}

function errorOf(path: string): string {
  const result = parsePointer(path);
  if (result.ok) {
    throw new Error(`expected ${path} to fail`);
  }
  return result.error;
}

describe('parsePointer', () => {
  test('parses plain and escaped segments', () => {
    expect(segmentsOf('/a/b')).toEqual(['a', 'b']);
    expect(segmentsOf('/')).toEqual(['']);
    expect(segmentsOf('/a//b')).toEqual(['a', '', 'b']);
    expect(segmentsOf('/~0zod')).toEqual(['~zod']);
    expect(segmentsOf('/a~1b')).toEqual(['a/b']);
    // RFC 6901: ~01 decodes to the literal string ~1, not to /
    expect(segmentsOf('/~01')).toEqual(['~1']);
  });

  test('rejects the empty pointer and missing leading slash', () => {
    expect(errorOf('')).toMatch(/empty pointer/);
    expect(errorOf('a/b')).toMatch(/must start with/);
    expect(errorOf('votes')).toMatch(/must start with/);
  });

  test('rejects invalid escapes', () => {
    expect(errorOf('/a~2b')).toMatch(/invalid escape/);
    expect(errorOf('/a~')).toMatch(/invalid escape/);
  });

  test('rejects prototype-polluting segments', () => {
    expect(errorOf('/__proto__')).toMatch(/forbidden segment/);
    expect(errorOf('/a/constructor')).toMatch(/forbidden segment/);
    expect(errorOf('/prototype/x')).toMatch(/forbidden segment/);
  });

  test('enforces length and segment caps at the boundary', () => {
    const okLength = '/' + 'a'.repeat(POINTER_MAX_LENGTH - 1);
    expect(parsePointer(okLength).ok).toBe(true);
    expect(errorOf(okLength + 'a')).toMatch(/exceeds 200 chars/);

    const okSegments = '/s'.repeat(POINTER_MAX_SEGMENTS);
    expect(parsePointer(okSegments).ok).toBe(true);
    expect(errorOf('/s'.repeat(POINTER_MAX_SEGMENTS + 1))).toMatch(
      /exceeds 12 segments/
    );
  });
});

describe('escaping round-trip', () => {
  test('escapes ship names per RFC 6901', () => {
    expect(escapePointerSegment('~zod')).toBe('~0zod');
    expect(escapePointerSegment('~sampel-palnet')).toBe('~0sampel-palnet');
    expect(unescapePointerSegment('~0zod')).toBe('~zod');
  });

  test('property: escape/unescape round-trips arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(unescapePointerSegment(escapePointerSegment(s))).toBe(s);
      })
    );
  });

  test('property: escape/unescape round-trips ship-name shapes', () => {
    const syllable = fc.constantFrom(
      'zod',
      'sampel',
      'palnet',
      'dirmec',
      'dolbes',
      'finned',
      'palmer',
      'racmus',
      'mollen',
      'pinser',
      'botter'
    );
    const ship = fc
      .tuple(
        fc.array(syllable, { minLength: 1, maxLength: 4 }),
        fc.boolean() // comet-style double hyphen joint
      )
      .map(
        ([syllables, comet]) =>
          '~' + syllables.join(comet && syllables.length > 2 ? '--' : '-')
      );
    fc.assert(
      fc.property(ship, (name) => {
        const escaped = escapePointerSegment(name);
        expect(escaped.startsWith('~0')).toBe(true);
        expect(unescapePointerSegment(escaped)).toBe(name);
        // and through a full pointer parse
        expect(segmentsOf(`/votes/${escaped}`)).toEqual(['votes', name]);
      })
    );
  });

  test('property: formatPointer/parsePointer round-trips segment lists', () => {
    // Segment length is bounded so the worst-case escaped path (every char
    // a ~ or /, doubling to 2 chars) stays within POINTER_MAX_LENGTH:
    // 12 segments x (1 + 2*7) = 180 <= 200.
    const segment = fc
      .string({ maxLength: 7 })
      .filter((s) => !['__proto__', 'constructor', 'prototype'].includes(s));
    fc.assert(
      fc.property(
        fc.array(segment, { minLength: 1, maxLength: POINTER_MAX_SEGMENTS }),
        (segments) => {
          expect(segmentsOf(formatPointer(segments))).toEqual(segments);
        }
      )
    );
  });
});

describe('applyOp set', () => {
  test('sets and creates missing intermediate objects', () => {
    const result = applyOp({}, { op: 'set', path: '/a/b/c', value: 1 });
    expect(result).toEqual({
      ok: true,
      state: { a: { b: { c: 1 } } },
      changed: true,
    });
  });

  test('never mutates the input state and shares untouched branches', () => {
    const state: JsonObject = { keep: { deep: [1, 2] }, a: { b: 1 } };
    const before = JSON.parse(JSON.stringify(state));
    const result = applyOp(state, { op: 'set', path: '/a/b', value: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.a).toEqual({ b: 2 });
      expect(result.state.keep).toBe(state.keep); // structural sharing
    }
    expect(state).toEqual(before);
  });

  test('fails writing through scalars and arrays', () => {
    expect(applyOp({ a: 5 }, { op: 'set', path: '/a/b', value: 1 }).ok).toBe(
      false
    );
    expect(
      applyOp({ a: [1, 2] }, { op: 'set', path: '/a/0', value: 9 }).ok
    ).toBe(false);
    expect(
      applyOp({ a: [1, 2] }, { op: 'set', path: '/a/0/b', value: 9 }).ok
    ).toBe(false);
  });

  test('numeric segments are plain object keys, not array indices', () => {
    const result = applyOp(
      { a: { '0': 'x' } },
      { op: 'set', path: '/a/0', value: 'y' }
    );
    expect(result).toMatchObject({ ok: true, state: { a: { '0': 'y' } } });
  });

  test('treats inherited names as absent', () => {
    const result = applyOp({}, { op: 'set', path: '/toString/x', value: 1 });
    expect(result).toMatchObject({
      ok: true,
      state: { toString: { x: 1 } },
    });
  });
});

describe('applyOp del', () => {
  test('deletes an existing key', () => {
    const result = applyOp({ a: { b: 1, c: 2 } }, { op: 'del', path: '/a/b' });
    expect(result).toEqual({ ok: true, state: { a: { c: 2 } }, changed: true });
  });

  test('is a no-op on every missing path, below scalars and arrays alike', () => {
    // A path that cannot exist is a path that cannot exist, whatever is
    // sitting in the way. The array branch used to be a `structure` refusal,
    // which after every refusal became an abort would have stopped the entry
    // over a `del` that had nothing to delete.
    const states = [
      {},
      { a: 5 },
      { a: { x: 1 } },
      { a: [1, 2] },
      { a: [{ b: 1 }] },
    ] as JsonObject[];
    for (const state of states) {
      const result = applyOp(state, { op: 'del', path: '/a/b' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.changed).toBe(false);
        expect(result.state).toBe(state);
      }
    }
  });

  test('does not delete inherited names', () => {
    const result = applyOp({}, { op: 'del', path: '/toString' });
    expect(result).toMatchObject({ ok: true, changed: false });
  });

  test('deleting an array element is silent, not an error', () => {
    // The accepted cost of the uniform no-op: §7 does not admit an array
    // index as a write target, and `del /a/0` now says nothing rather than
    // refusing. `set` still refuses to write through an array, so the
    // asymmetry is only in `del`.
    const state: JsonObject = { a: [{ b: 1 }] };
    expect(applyOp(state, { op: 'del', path: '/a/0' })).toEqual({
      ok: true,
      state,
      changed: false,
    });
    expect(applyOp(state, { op: 'del', path: '/a/0/b' })).toEqual({
      ok: true,
      state,
      changed: false,
    });
    expect(applyOp(state, { op: 'set', path: '/a/0/b', value: 2 })).toEqual({
      ok: false,
      refusal: 'structure',
      error: 'cannot write through non-object at segment: a',
    });
  });
});

describe('applyOp append', () => {
  test('appends to an existing array', () => {
    const result = applyOp(
      { log: [1] },
      { op: 'append', path: '/log', value: 2 }
    );
    expect(result).toEqual({ ok: true, state: { log: [1, 2] }, changed: true });
  });

  test('requires an existing array target', () => {
    expect(applyOp({}, { op: 'append', path: '/log', value: 1 }).ok).toBe(
      false
    );
    expect(
      applyOp({ log: 'nope' }, { op: 'append', path: '/log', value: 1 }).ok
    ).toBe(false);
    expect(
      applyOp({ log: { a: 1 } }, { op: 'append', path: '/log', value: 1 }).ok
    ).toBe(false);
  });
});

describe('$actor substitution', () => {
  test('substitutes a whole path segment with the actor', () => {
    const result = applyOp(
      {},
      { op: 'set', path: '/votes/$actor', value: 'yes' },
      { actor: '~sampel-palnet' }
    );
    expect(result).toMatchObject({
      ok: true,
      state: { votes: { '~sampel-palnet': 'yes' } },
    });
  });

  test('substitutes exact-string values, deeply, leaving substrings alone', () => {
    const result = applyOp(
      { log: [] },
      {
        op: 'append',
        path: '/log',
        value: { who: '$actor', note: 'went to $actor town', tags: ['$actor'] },
      },
      { actor: '~zod' }
    );
    expect(result).toMatchObject({
      ok: true,
      state: {
        log: [{ who: '~zod', note: 'went to $actor town', tags: ['~zod'] }],
      },
    });
  });

  test('rejects partial-segment use', () => {
    const result = applyOp(
      {},
      { op: 'set', path: '/votes/x$actor', value: 1 },
      { actor: '~zod' }
    );
    expect(result.ok).toBe(false);
  });

  test('rejects any $actor use in host ops (no actor)', () => {
    expect(applyOp({}, { op: 'set', path: '/votes/$actor', value: 1 }).ok).toBe(
      false
    );
    expect(
      applyOp({}, { op: 'set', path: '/x', value: { who: '$actor' } }).ok
    ).toBe(false);
    expect(
      applyOp({ log: [] }, { op: 'append', path: '/log', value: ['$actor'] }).ok
    ).toBe(false);
  });

  test('host ops without $actor apply normally', () => {
    const result = applyOp({}, { op: 'set', path: '/title', value: 'Poll' });
    expect(result).toMatchObject({ ok: true, state: { title: 'Poll' } });
  });
});

describe('applyOp with reserved-looking state keys', () => {
  test('state containing an `error` key along the path is just state', () => {
    const state: JsonObject = { error: { count: 1 } };
    const result = applyOp(state, {
      op: 'set',
      path: '/error/count',
      value: 2,
    });
    expect(result).toMatchObject({
      ok: true,
      state: { error: { count: 2 } },
    });
    const appended = applyOp(
      { error: [] },
      { op: 'append', path: '/error', value: 'e' }
    );
    expect(appended).toMatchObject({ ok: true, state: { error: ['e'] } });
    const deleted = applyOp(
      { error: { next: 1 } },
      { op: 'del', path: '/error/next' }
    );
    expect(deleted).toMatchObject({ ok: true, state: { error: {} } });
  });
});

describe('applyOp value hardening', () => {
  test('rejects non-JSON and prototype-polluting op values', () => {
    expect(
      applyOp({}, { op: 'set', path: '/a', value: undefined as never }).ok
    ).toBe(false);
    expect(applyOp({}, { op: 'set', path: '/a', value: NaN as never }).ok).toBe(
      false
    );
    expect(
      applyOp(
        {},
        {
          op: 'set',
          path: '/a',
          value: JSON.parse('{"__proto__": 1}'),
        }
      ).ok
    ).toBe(false);
  });

  test('keeps state within the depth cap', () => {
    // value depth 14 at 2 path segments = 16: allowed
    let deep: Json = 'leaf';
    for (let i = 0; i < 14; i++) deep = { k: deep };
    expect(applyOp({}, { op: 'set', path: '/a/b', value: deep }).ok).toBe(true);
    // one more level of value depth would exceed the cap
    expect(
      applyOp({}, { op: 'set', path: '/a/b', value: { k: deep } }).ok
    ).toBe(false);
    // append counts its target array as one more container
    expect(
      applyOp({ a: { b: [] } }, { op: 'append', path: '/a/b', value: deep }).ok
    ).toBe(false);
  });
});

describe('applyOp property tests', () => {
  const opArb: fc.Arbitrary<SurfaceOp> = fc.oneof(
    fc.record({
      op: fc.constant('set' as const),
      path: fc.constantFrom('/a', '/a/b', '/votes/$actor', '/x/y/z', '/list'),
      value: fc.jsonValue({ maxDepth: 3 }) as fc.Arbitrary<Json>,
    }),
    fc.record({
      op: fc.constant('del' as const),
      path: fc.constantFrom('/a', '/a/b', '/missing', '/list'),
    }),
    fc.record({
      op: fc.constant('append' as const),
      path: fc.constantFrom('/list', '/a', '/missing'),
      value: fc.jsonValue({ maxDepth: 2 }) as fc.Arbitrary<Json>,
    })
  );

  test('property: never throws and never mutates input', () => {
    fc.assert(
      fc.property(
        opArb,
        fc.option(fc.constantFrom('~zod', '~sampel-palnet'), {
          nil: undefined,
        }),
        (op, actor) => {
          const state: JsonObject = { a: { b: 1 }, list: [1, 2] };
          const before = JSON.parse(JSON.stringify(state));
          const result = applyOp(state, op, { actor });
          expect(state).toEqual(before);
          if (result.ok) {
            expect(result.state).toBeDefined();
          }
        }
      )
    );
  });

  test('property: applying the same op twice from the same state is deterministic', () => {
    fc.assert(
      fc.property(opArb, (op) => {
        const state: JsonObject = { a: { b: 1 }, list: [1, 2] };
        const first = applyOp(state, op, { actor: '~zod' });
        const second = applyOp(state, op, { actor: '~zod' });
        expect(second).toEqual(first);
      })
    );
  });

  test('property: set at /votes/$actor is idempotent per actor', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('~zod', '~ten', '~sampel-palnet'),
        fc.jsonValue({ maxDepth: 2 }) as fc.Arbitrary<Json>,
        (actor, value) => {
          // jsonValue occasionally generates forbidden object keys
          // (__proto__ et al.), which applyOp rightly rejects; idempotence
          // is a property of valid values only.
          fc.pre(isJson(value));
          const op: SurfaceOp = {
            op: 'set',
            path: '/votes/$actor',
            value,
          };
          const once = applyOp({}, op, { actor });
          expect(once.ok).toBe(true);
          if (!once.ok) return;
          const twice = applyOp(once.state, op, { actor });
          expect(twice.ok).toBe(true);
          if (!twice.ok) return;
          expect(twice.state).toEqual(once.state);
        }
      )
    );
  });
});
