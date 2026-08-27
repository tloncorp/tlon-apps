import { describe, expect, test } from 'vitest';

import type { Json, JsonObject } from '../client/surface/json';
import { jsonByteLength } from '../client/surface/json';
import { reduceSurface } from '../client/surface/reducer';
import {
  SURFACE_CAPS,
  SurfaceActionSchema,
  SurfaceEventEntrySchema,
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
    expect(SurfaceSpecSchema.safeParse(validSpec({ recipe: at })).success).toBe(
      true
    );
    expect(
      SurfaceSpecSchema.safeParse(validSpec({ recipe: over })).success
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
