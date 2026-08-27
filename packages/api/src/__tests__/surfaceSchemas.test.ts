import { describe, expect, test } from 'vitest';

import { parsePostBlob } from '../client/content-helpers';
import {
  SURFACE_CAPS,
  SurfaceEventEntrySchema,
  SurfaceSnapshotEntrySchema,
  SurfaceSpec,
  SurfaceSpecMirrorEntrySchema,
  SurfaceSpecSchema,
  getDeclaredAction,
} from '../client/surface/schemas';

export function validSpec(overrides: Partial<SurfaceSpec> = {}): SurfaceSpec {
  return {
    version: 1,
    surfaceId: 'srf-0001',
    specRevision: 3,
    title: 'Potluck',
    bundle: {
      assetRef: 'https://storage.example/bundles/abc',
      sha256: 'a'.repeat(64),
      size: 4096,
      shellVersion: 1,
    },
    initialState: { items: [], votes: {} },
    actions: {
      'claim-slot': {
        ops: [{ op: 'set', path: '/items/$actor', value: true }],
      },
      vote: {
        ops: [{ op: 'set', path: '/votes/$actor', value: '$actor' }],
        acceptStale: true,
      },
    },
    ...overrides,
  };
}

function validHostEvent() {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: 'srf-0001',
    specRevision: 3,
    mode: 'host',
    ops: [{ op: 'set', path: '/title', value: 'Potluck' }],
  };
}

function validInvokeEvent() {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: 'srf-0001',
    specRevision: 3,
    mode: 'invoke',
    actionId: 'vote',
  };
}

function validSnapshot() {
  return {
    type: 'surface-snapshot',
    version: 1,
    surfaceId: 'srf-0001',
    specRevision: 3,
    upToSequenceNum: 41,
    state: { items: { '~zod': true } },
  };
}

describe('SurfaceSpecSchema', () => {
  test('accepts a valid spec', () => {
    expect(SurfaceSpecSchema.safeParse(validSpec()).success).toBe(true);
  });

  test('rejects malformed specs', () => {
    const cases: Array<Partial<SurfaceSpec> | Record<string, unknown>> = [
      { version: 2 },
      { surfaceId: '' },
      { specRevision: -1 },
      { specRevision: 1.5 },
      { bundle: undefined },
      {
        bundle: {
          assetRef: 'x',
          sha256: 'not-hex',
          size: 10,
          shellVersion: 1,
        },
      },
      {
        bundle: {
          assetRef: 'x',
          sha256: 'a'.repeat(64),
          size: SURFACE_CAPS.bundleSize + 1,
          shellVersion: 1,
        },
      },
      { initialState: [1, 2] as never },
      { initialState: 'nope' as never },
      { actions: { 'Bad Id!': { ops: [] } } as never },
      { actions: { ['a'.repeat(65)]: { ops: [] } } as never },
      { actions: { constructor: { ops: [] } } as never },
    ];
    for (const override of cases) {
      const spec = { ...validSpec(), ...override };
      expect(SurfaceSpecSchema.safeParse(spec).success).toBe(false);
    }
  });

  test('accepts unknown keys without failing (forward compat)', () => {
    const spec = { ...validSpec(), futureField: { anything: true } };
    const parsed = SurfaceSpecSchema.safeParse(spec);
    expect(parsed.success).toBe(true);
  });

  test('getDeclaredAction resolves only own declared actions', () => {
    const spec = SurfaceSpecSchema.parse(validSpec());
    expect(getDeclaredAction(spec, 'vote')).toBeDefined();
    expect(getDeclaredAction(spec, 'missing')).toBeUndefined();
    expect(getDeclaredAction(spec, 'toString')).toBeUndefined();
    expect(getDeclaredAction(spec, 'constructor')).toBeUndefined();
  });
});

describe('SurfaceEventEntrySchema', () => {
  test('accepts both arms', () => {
    expect(SurfaceEventEntrySchema.safeParse(validHostEvent()).success).toBe(
      true
    );
    expect(SurfaceEventEntrySchema.safeParse(validInvokeEvent()).success).toBe(
      true
    );
  });

  test('requires specRevision on both arms', () => {
    for (const base of [validHostEvent(), validInvokeEvent()]) {
      const rest: Record<string, unknown> = { ...base };
      delete rest.specRevision;
      expect(SurfaceEventEntrySchema.safeParse(rest).success).toBe(false);
    }
  });

  test('rejects cross-arm and malformed shapes', () => {
    const cases = [
      { ...validHostEvent(), mode: 'invoke' }, // invoke with ops, no actionId
      { ...validInvokeEvent(), actionId: 'Not Valid' },
      { ...validInvokeEvent(), actionId: '' },
      { ...validHostEvent(), ops: 'nope' },
      { ...validHostEvent(), version: 2 },
      { ...validHostEvent(), mode: 'admin' },
      { ...validHostEvent(), ops: [{ op: 'replace', path: '/x', value: 1 }] },
      { ...validHostEvent(), ops: [{ op: 'set', path: '/x', value: NaN }] },
    ];
    for (const entry of cases) {
      expect(SurfaceEventEntrySchema.safeParse(entry).success).toBe(false);
    }
  });

  test('strips smuggled ops from invoke entries', () => {
    const smuggled = {
      ...validInvokeEvent(),
      ops: [{ op: 'set', path: '/hacked', value: true }],
    };
    const parsed = SurfaceEventEntrySchema.safeParse(smuggled);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('ops' in parsed.data).toBe(false);
    }
  });

  test('enforces ops-per-event and op-value caps at the boundary', () => {
    const op = { op: 'set', path: '/x', value: 1 };
    const atCap = {
      ...validHostEvent(),
      ops: Array(SURFACE_CAPS.opsPerEvent).fill(op),
    };
    expect(SurfaceEventEntrySchema.safeParse(atCap).success).toBe(true);
    const overCap = {
      ...validHostEvent(),
      ops: Array(SURFACE_CAPS.opsPerEvent + 1).fill(op),
    };
    expect(SurfaceEventEntrySchema.safeParse(overCap).success).toBe(false);

    // op value cap: string of N bytes serializes to N+2 bytes with quotes
    const okValue = 'x'.repeat(SURFACE_CAPS.opValue - 2);
    const bigValue = 'x'.repeat(SURFACE_CAPS.opValue - 1);
    expect(
      SurfaceEventEntrySchema.safeParse({
        ...validHostEvent(),
        ops: [{ op: 'set', path: '/x', value: okValue }],
      }).success
    ).toBe(true);
    expect(
      SurfaceEventEntrySchema.safeParse({
        ...validHostEvent(),
        ops: [{ op: 'set', path: '/x', value: bigValue }],
      }).success
    ).toBe(false);
  });

  test('enforces the entry-total cap', () => {
    // 3 ops of ~3.9KB each pass per-op caps but blow the 8KB entry total
    const chunk = 'x'.repeat(3900);
    const entry = {
      ...validHostEvent(),
      ops: [
        { op: 'set', path: '/a', value: chunk },
        { op: 'set', path: '/b', value: chunk },
        { op: 'set', path: '/c', value: chunk },
      ],
    };
    expect(SurfaceEventEntrySchema.safeParse(entry).success).toBe(false);
  });
});

describe('SurfaceSnapshotEntrySchema', () => {
  test('accepts a valid snapshot', () => {
    expect(SurfaceSnapshotEntrySchema.safeParse(validSnapshot()).success).toBe(
      true
    );
  });

  test('rejects malformed snapshots', () => {
    const cases = [
      { ...validSnapshot(), upToSequenceNum: -1 },
      { ...validSnapshot(), upToSequenceNum: 1.5 },
      { ...validSnapshot(), state: [1] },
      { ...validSnapshot(), state: null },
      { ...validSnapshot(), version: 2 },
      { ...validSnapshot(), surfaceId: '' },
      (() => {
        const rest: Record<string, unknown> = { ...validSnapshot() };
        delete rest.specRevision;
        return rest;
      })(),
    ];
    for (const entry of cases) {
      expect(SurfaceSnapshotEntrySchema.safeParse(entry).success).toBe(false);
    }
  });

  test('enforces the snapshot state cap at the boundary', () => {
    const pad = (bytes: number) => ({
      ...validSnapshot(),
      state: { pad: 'x'.repeat(bytes) },
    });
    // {"pad":"..."} adds 10 bytes of structure around the padding
    expect(
      SurfaceSnapshotEntrySchema.safeParse(pad(SURFACE_CAPS.snapshotState - 10))
        .success
    ).toBe(true);
    expect(
      SurfaceSnapshotEntrySchema.safeParse(pad(SURFACE_CAPS.snapshotState - 9))
        .success
    ).toBe(false);
  });
});

describe('SurfaceSpecMirrorEntrySchema', () => {
  test('accepts a valid mirror and rejects a bad inner spec', () => {
    const entry = {
      type: 'surface-spec-mirror',
      version: 1,
      surfaceId: 'srf-0001',
      specRevision: 3,
      spec: validSpec(),
    };
    expect(SurfaceSpecMirrorEntrySchema.safeParse(entry).success).toBe(true);
    expect(
      SurfaceSpecMirrorEntrySchema.safeParse({
        ...entry,
        spec: { ...validSpec(), bundle: null },
      }).success
    ).toBe(false);
  });
});

describe('blob registry integration', () => {
  test('parsePostBlob validates surface entries through the shared union', () => {
    const blob = JSON.stringify([
      validHostEvent(),
      validInvokeEvent(),
      validSnapshot(),
    ]);
    const parsed = parsePostBlob(blob);
    expect(parsed.map((entry) => entry.type)).toEqual([
      'surface-event',
      'surface-event',
      'surface-snapshot',
    ]);
  });

  test('malformed surface entries degrade to unknown without touching valid ones', () => {
    const blob = JSON.stringify([
      { ...validHostEvent(), mode: 'admin' },
      validInvokeEvent(),
      { type: 'surface-snapshot', version: 99 },
    ]);
    const parsed = parsePostBlob(blob);
    expect(parsed.map((entry) => entry.type)).toEqual([
      'unknown',
      'surface-event',
      'unknown',
    ]);
  });

  test('existing entry types keep validating alongside surface entries', () => {
    const blob = JSON.stringify([
      { type: 'file', version: 1, fileUri: 'https://x/y.pdf', size: 10 },
      validInvokeEvent(),
    ]);
    const parsed = parsePostBlob(blob);
    expect(parsed.map((entry) => entry.type)).toEqual([
      'file',
      'surface-event',
    ]);
  });
});
