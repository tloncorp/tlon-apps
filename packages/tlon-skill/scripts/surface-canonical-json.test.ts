import { describe, expect, it } from 'bun:test';

import { canonicalJson } from './surface-canonical-json';

describe('canonicalJson', () => {
  it('is insensitive to key order at every depth', () => {
    expect(canonicalJson({ b: { d: 1, c: 2 }, a: [3, { f: 4, e: 5 }] })).toBe(
      canonicalJson({ a: [3, { e: 5, f: 4 }], b: { c: 2, d: 1 } })
    );
  });

  it('is sensitive to array order, which is meaning', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('distinguishes values a loose comparison would merge', () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: '1' }));
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
  });

  /**
   * The property the three divergent copies disagreed on, and the reason this
   * one survived. Every comparison the helper serves has JSON text on at least
   * one side — a spec written into a channel's description cell and read back
   * out of it — so the only defensible semantics are the ones a write/read
   * cycle leaves behind. A helper that draws a distinction JSON cannot carry
   * reports "changed" for a value that did not change.
   */
  describe('agrees with what a JSON round trip leaves behind', () => {
    const roundTrip = (value: unknown): unknown =>
      JSON.parse(JSON.stringify(value));

    it('drops an undefined-valued key, as stringify does', () => {
      expect(canonicalJson({ a: 1, b: undefined })).toBe(
        canonicalJson({ a: 1 })
      );
    });

    it('nulls an undefined inside an array, as stringify does', () => {
      expect(canonicalJson([1, undefined, 2])).toBe(
        canonicalJson([1, null, 2])
      );
    });

    it('matches itself across a round trip, at depth', () => {
      const value = {
        surfaceId: 'srf',
        bundle: { sha256: 'a'.repeat(64), size: 10 },
        actions: { vote: { ops: [{ op: 'set', at: '/x' }], stale: undefined } },
        rows: [1, 'two', null, { z: 1, a: undefined }],
        preserveState: false,
      };
      expect(canonicalJson(value)).toBe(canonicalJson(roundTrip(value)));
    });
  });
});
