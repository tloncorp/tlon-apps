import { describe, expect, test } from 'vitest';

import type { Json, JsonObject } from '../client/surface/json';
import { jsonByteLength } from '../client/surface/json';
import { reduceSurface } from '../client/surface/reducer';
import {
  SURFACE_CAPS,
  SurfaceActionSchema,
  SurfaceEventEntrySchema,
  SurfaceSnapshotEntrySchema,
  SurfaceSpecSchema,
} from '../client/surface/schemas';
import { validSpec } from './surfaceSchemas.test';

/**
 * Boundary tests for every §7 cap enforced at parse/validation. Each cap is
 * exercised exactly at the cap (accepted) and one byte/item over
 * (rejected). Depth (16), pointer length (200) / segments (12), op count,
 * op value, and snapshot state boundaries are covered in the json, pointer,
 * and schema test files; this file sweeps the rest.
 */

/** Build `at`/`over` variants by padding a string to land exactly on cap. */
function padToCap(cap: number, build: (pad: string) => unknown) {
  const base = jsonByteLength(build('') as Json);
  const pad = 'x'.repeat(cap - base);
  const at = build(pad);
  const over = build(pad + 'x');
  expect(jsonByteLength(at as Json)).toBe(cap);
  expect(jsonByteLength(over as Json)).toBe(cap + 1);
  return { at, over };
}

describe('spec caps', () => {
  test('bundle size: 256 KB accepted, one byte over rejected', () => {
    const withSize = (size: number) =>
      validSpec({
        bundle: {
          assetRef: 'https://x/b',
          sha256: 'a'.repeat(64),
          size,
          shellVersion: 1,
        },
      });
    expect(
      SurfaceSpecSchema.safeParse(withSize(SURFACE_CAPS.bundleSize)).success
    ).toBe(true);
    expect(
      SurfaceSpecSchema.safeParse(withSize(SURFACE_CAPS.bundleSize + 1)).success
    ).toBe(false);
  });

  test('initialState: 8 KB accepted, one byte over rejected', () => {
    const { at, over } = padToCap(SURFACE_CAPS.initialState, (pad) => ({
      pad,
    }));
    expect(
      SurfaceSpecSchema.safeParse(validSpec({ initialState: at as JsonObject }))
        .success
    ).toBe(true);
    expect(
      SurfaceSpecSchema.safeParse(
        validSpec({ initialState: over as JsonObject })
      ).success
    ).toBe(false);
  });

  test('recipe: 8 KB accepted, one byte over rejected', () => {
    const { at, over } = padToCap(SURFACE_CAPS.recipe, (pad) => ({ pad }));
    expect(
      SurfaceSpecSchema.safeParse(validSpec({ recipe: at as Json })).success
    ).toBe(true);
    expect(
      SurfaceSpecSchema.safeParse(validSpec({ recipe: over as Json })).success
    ).toBe(false);
  });

  test('actions per spec: 64 accepted, 65 rejected', () => {
    const actions = (count: number) =>
      Object.fromEntries(
        Array.from({ length: count }, (_, i) => [`action-${i}`, { ops: [] }])
      );
    expect(
      SurfaceSpecSchema.safeParse(
        validSpec({ actions: actions(SURFACE_CAPS.actionsPerSpec) })
      ).success
    ).toBe(true);
    expect(
      SurfaceSpecSchema.safeParse(
        validSpec({ actions: actions(SURFACE_CAPS.actionsPerSpec + 1) })
      ).success
    ).toBe(false);
  });

  test('ops per action: 20 accepted, 21 rejected', () => {
    const op = { op: 'set', path: '/x', value: 1 };
    expect(
      SurfaceActionSchema.safeParse({
        ops: Array(SURFACE_CAPS.opsPerEvent).fill(op),
      }).success
    ).toBe(true);
    expect(
      SurfaceActionSchema.safeParse({
        ops: Array(SURFACE_CAPS.opsPerEvent + 1).fill(op),
      }).success
    ).toBe(false);
  });

  test('spec metadata total: 32 KB accepted, one byte over rejected', () => {
    // title has no itemized cap, so it pads the whole-spec serialization
    // onto the boundary exactly.
    const { at, over } = padToCap(SURFACE_CAPS.specTotal, (pad) =>
      validSpec({ title: pad })
    );
    expect(SurfaceSpecSchema.safeParse(at).success).toBe(true);
    expect(SurfaceSpecSchema.safeParse(over).success).toBe(false);
  });
});

describe('event entry total cap', () => {
  test('8 KB accepted, one byte over rejected', () => {
    // The pad splits across two op values so each stays under the 4 KB
    // op-value cap while the whole entry lands exactly on the entry cap
    // (every ASCII pad char adds exactly one serialized byte).
    const { at, over } = padToCap(SURFACE_CAPS.eventEntryTotal, (pad) => {
      const half = Math.ceil(pad.length / 2);
      return {
        type: 'surface-event',
        version: 1,
        surfaceId: 'srf-0001',
        specRevision: 3,
        mode: 'host',
        ops: [
          { op: 'set', path: '/pad', value: pad.slice(0, half) },
          { op: 'set', path: '/pa2', value: pad.slice(half) },
        ],
      };
    });
    expect(SurfaceEventEntrySchema.safeParse(at).success).toBe(true);
    expect(SurfaceEventEntrySchema.safeParse(over).success).toBe(false);
  });
});

describe('reduced state cap (reducer-enforced)', () => {
  test('an op landing exactly on 128 KB applies; one byte more is refused', () => {
    const spec = validSpec({
      initialState: {},
      actions: {},
    });
    let seq = 1;
    const chunk = 'x'.repeat(4000);
    const hostPost = (ops: unknown[]) => ({
      authorId: '~zod',
      // Required since D189: a post with no tie-break id is structurally
      // unfoldable and the reducer skips it outright.
      id: 'post-' + seq,
      sequenceNum: seq++,
      blob: JSON.stringify([
        {
          type: 'surface-event',
          version: 1,
          surfaceId: 'srf-0001',
          specRevision: 3,
          mode: 'host',
          ops,
        },
      ]),
    });

    // Fill state close to the cap with 4 KB sets to distinct keys, then one
    // smaller set so the remaining room fits inside a single op value.
    const fillers = [
      ...Array.from({ length: 31 }, (_, i) =>
        hostPost([{ op: 'set', path: `/p${i}`, value: chunk }])
      ),
      hostPost([{ op: 'set', path: '/q', value: 'x'.repeat(3000) }]),
    ];
    const filled = reduceSurface({
      spec,
      hostShip: '~zod',
      posts: fillers,
    });
    expect(filled.status).toBe('reduced');
    if (filled.status !== 'reduced') return;
    const currentSize = jsonByteLength(filled.state);

    // Adding key "final" with value v costs `,"final":"<v>"` = 11 + v.length
    // bytes on top of the current serialization.
    const room = SURFACE_CAPS.reducedState - currentSize - 11;
    expect(room).toBeGreaterThan(0);
    expect(room).toBeLessThan(4096 - 2); // stays under the op value cap

    const atCap = reduceSurface({
      spec,
      hostShip: '~zod',
      posts: [
        ...fillers,
        hostPost([{ op: 'set', path: '/final', value: 'y'.repeat(room) }]),
      ],
    });
    expect(atCap.status).toBe('reduced');
    if (atCap.status !== 'reduced') return;
    expect(jsonByteLength(atCap.state)).toBe(SURFACE_CAPS.reducedState);
    expect(atCap.stateFull).toBe(false);

    const overCap = reduceSurface({
      spec,
      hostShip: '~zod',
      posts: [
        ...fillers,
        hostPost([{ op: 'set', path: '/final', value: 'y'.repeat(room + 1) }]),
      ],
    });
    expect(overCap.status).toBe('reduced');
    if (overCap.status !== 'reduced') return;
    expect(overCap.stateFull).toBe(true);
    expect((overCap.state as JsonObject).final).toBeUndefined();
    expect(jsonByteLength(overCap.state)).toBe(currentSize);
  });
});

/**
 * The invariant the two state caps have to satisfy together: **anything the
 * reducer will hold, a snapshot must be able to carry.**
 *
 * They were set independently — the reducer refused ops above 128 KB while
 * the snapshot schema rejected states above 64 KB — which left a legal band
 * of live states that could be reduced and could not be written down. A
 * preserving publish folds such a state, moves the definition, and only then
 * discovers the snapshot will not validate: the channel lands on a revision
 * that requires a migration snapshot nobody can post, and `--preserve-state`
 * strands it permanently.
 *
 * The band is the bug, so the control is the band's absence, not either
 * number: pin the relation, and fold a real state up to the reducer's own
 * limit to show the snapshot schema still takes it.
 */
describe('reduced state and snapshot state agree', () => {
  test('the snapshot cap is never below the reducer cap', () => {
    expect(SURFACE_CAPS.snapshotState).toBeGreaterThanOrEqual(
      SURFACE_CAPS.reducedState
    );
  });

  test('a state folded to the reducer cap still validates as a snapshot', () => {
    const spec = validSpec({ initialState: {}, actions: {} });
    let seq = 1;
    const hostPost = (ops: unknown[]) => ({
      authorId: '~zod',
      // Required since D189: a post with no tie-break id is structurally
      // unfoldable and the reducer skips it outright.
      id: 'post-' + seq,
      sequenceNum: seq++,
      blob: JSON.stringify([
        {
          type: 'surface-event',
          version: 1,
          surfaceId: 'srf-0001',
          specRevision: 3,
          mode: 'host',
          ops,
        },
      ]),
    });

    // 4 KB-ish sets to distinct keys, enough of them to fill the reducer's
    // whole allowance. Every op is legal on its own (under the 4 KB op-value
    // cap, one op per entry, well under the 8 KB entry cap), so nothing here
    // depends on abusing a cap to reach the band.
    const chunk = 'x'.repeat(4000);
    const posts = Array.from({ length: 25 }, (_, i) =>
      hostPost([{ op: 'set', path: `/p${i}`, value: chunk }])
    );
    const reduced = reduceSurface({ spec, hostShip: '~zod', posts });
    expect(reduced.status).toBe('reduced');
    if (reduced.status !== 'reduced') return;

    // The premise: this is a state the reducer really does hold, and it sits
    // above where the snapshot cap used to be.
    const size = jsonByteLength(reduced.state);
    expect(size).toBeGreaterThan(64 * 1024);
    expect(size).toBeLessThanOrEqual(SURFACE_CAPS.reducedState);
    expect(reduced.stateFull).toBe(false);

    expect(
      SurfaceSnapshotEntrySchema.safeParse({
        type: 'surface-snapshot',
        version: 1,
        surfaceId: 'srf-0001',
        specRevision: 3,
        upToSequenceNum: 25,
        state: reduced.state,
      }).success
    ).toBe(true);
  });
});
