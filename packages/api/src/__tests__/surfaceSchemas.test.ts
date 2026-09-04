import { describe, expect, test } from 'vitest';

import { parsePostBlob } from '../client/content-helpers';
import {
  PublishableSurfaceSpecSchema,
  readSurfaceSpec,
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

  test('an action survives validation carrying duplicatesTolerated', () => {
    // The gate's `append` opt-out has to come back OUT of the schema, not
    // just go in. `z.object` strips what it does not declare, so while the
    // marker was undeclared it was present in every written spec and absent
    // from the validated read-back of that same spec — and every comparison
    // of the two saw a change that was not there (D67, D72, and the
    // `decideRevision` false bump that reset live state on a no-op
    // republish). The contrast below is the mechanism: a genuinely unknown
    // key still vanishes, which is exactly what the marker used to do.
    const spec = validSpec({
      actions: {
        'add-note': {
          ops: [{ op: 'append', path: '/log', value: '$actor' }],
          duplicatesTolerated: true,
        },
      },
    });
    const parsed = SurfaceSpecSchema.parse({
      ...spec,
      actions: {
        'add-note': { ...spec.actions['add-note'], stillUnknown: true },
      },
    });
    expect(parsed.actions['add-note'].duplicatesTolerated).toBe(true);
    expect(parsed.actions['add-note']).not.toHaveProperty('stillUnknown');
  });

  test('a spec survives validation carrying memberInteraction', () => {
    // Same mechanism as duplicatesTolerated above, one level up: the gate's
    // opt-out from the empty-action-map warning has to survive the round
    // trip, or a display-only app declares itself inert and the validated
    // read-back says it never did. The unknown key beside it is the contrast
    // — it still vanishes, which is what the marker would do undeclared.
    const parsed = SurfaceSpecSchema.parse({
      ...validSpec({ actions: {} }),
      memberInteraction: {
        mode: 'none',
        because: 'the launch date is fixed at creation',
      },
      stillUnknown: true,
    });
    expect(parsed.memberInteraction).toEqual({
      mode: 'none',
      because: 'the launch date is fixed at creation',
    });
    expect(parsed).not.toHaveProperty('stillUnknown');
  });

  test('refuses memberInteraction beside a nonempty action map (D191)', () => {
    // The marker is an opt-out from a rule that only fires on an EMPTY action
    // map, so beside a nonempty one it asserts nothing and contradicts what it
    // sits next to. It was permitted: lint's own check returned early whenever
    // actions existed, and the rubric keys check 8 off the marker's PRESENCE
    // alone — so an actionful spec could declare "members cannot act", pass
    // the gate clean, and generate a display-only check for a board full of
    // controls. Refused on the WRITE path, so nothing new can carry it while
    // definitions already published stay readable (D198).
    const contradictory = {
      ...validSpec(),
      memberInteraction: {
        mode: 'none' as const,
        because: 'the bot posts the rollover each morning',
      },
    };
    expect(Object.keys(contradictory.actions).length).toBeGreaterThan(0);
    const refused = PublishableSurfaceSpecSchema.safeParse(contradictory);
    expect(refused.success).toBe(false);
    // and it names the marker, not some downstream field — the repair loop
    // reads the path to decide what to change
    const issue = refused.success
      ? undefined
      : refused.error.issues.find(
          (entry) => entry.path.join('.') === 'memberInteraction'
        );
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('members cannot act');

    // Neither half alone is a contradiction, and refusing either would be
    // refusing a legitimate shape. A display-only app declares the marker
    // over an empty map ...
    expect(
      PublishableSurfaceSpecSchema.safeParse({
        ...validSpec({ actions: {} }),
        memberInteraction: {
          mode: 'none',
          because: 'the launch date is fixed at creation',
        },
      }).success
    ).toBe(true);
    // ... and an ordinary interactive app carries actions and no marker.
    expect(PublishableSurfaceSpecSchema.safeParse(validSpec()).success).toBe(
      true
    );
  });

  test('the READER still accepts a spec the base publisher accepted (D198)', () => {
    // The refusal above is retroactive if a reader applies it. `readSurfaceSpec`
    // runs on the description cell of every channel a client opens, and a spec
    // it rejects is `invalid` — which hydration treats as "never fold, never
    // fall back". So a rule added to the reader takes a live board dark on
    // upgrade, with its event log intact and unreachable underneath.
    //
    // This exact shape WAS publishable: this project's own fork fixture carried
    // a nonempty action map beside the marker and treated the result as
    // publishable, so it is a version-1 wire shape in the field and not a
    // hypothetical. The protocol version did not change, so a reader that
    // refuses it is a reader that broke compatibility with itself.
    const alreadyPublished = {
      ...validSpec(),
      memberInteraction: {
        mode: 'none' as const,
        because: 'the bot posts the rollover every morning',
      },
    };
    expect(Object.keys(alreadyPublished.actions).length).toBeGreaterThan(0);

    // the writer refuses it ...
    expect(
      PublishableSurfaceSpecSchema.safeParse(alreadyPublished).success
    ).toBe(false);
    // ... and the reader does not, which is the whole of the split.
    expect(SurfaceSpecSchema.safeParse(alreadyPublished).success).toBe(true);

    // End to end, through the function a client actually calls: `invalid` here
    // is the board going dark, so this is the assertion that matters.
    const read = readSurfaceSpec(JSON.stringify(alreadyPublished));
    expect(read.status).toBe('valid');
  });

  test('a spec survives validation carrying timeDisplay', () => {
    // Declared for the same reason `duplicatesTolerated` and
    // `memberInteraction` are: `z.object` strips what it does not declare, so
    // an undeclared marker is present in a written spec and absent from the
    // validated read-back of that same spec, and every comparison of the two
    // sees a difference that is not there. The unknown key beside it is the
    // contrast — it still vanishes.
    const parsed = SurfaceSpecSchema.parse({
      ...validSpec(),
      timeDisplay: { refreshSeconds: 60 },
      stillUnknown: true,
    });
    expect(parsed.timeDisplay).toEqual({ refreshSeconds: 60 });
    expect(parsed).not.toHaveProperty('stillUnknown');
  });

  test('rejects a refresh cadence that is not a usable one', () => {
    // Bounded at both ends: below 1s no viewer can read the difference, above
    // a day it is a reason to reopen the screen rather than a timer. The
    // non-integer and the negative are the shapes a model reaches for.
    for (const refreshSeconds of [0, -1, 0.5, 86401, '60', null]) {
      const spec = {
        ...validSpec(),
        timeDisplay: { refreshSeconds } as never,
      };
      expect(SurfaceSpecSchema.safeParse(spec).success).toBe(false);
    }
  });

  test('rejects a memberInteraction whose mode is not "none"', () => {
    // One legal mode, so the near-misses a model would reach for are the cases
    // worth pinning: a capitalised variant, a plausible-but-undeclared word,
    // and the boolean this deliberately is not.
    for (const mode of ['None', 'members', true, 1, null]) {
      const spec = {
        ...validSpec(),
        memberInteraction: { mode, because: 'x' } as never,
      };
      expect(SurfaceSpecSchema.safeParse(spec).success).toBe(false);
    }
  });

  test('rejects the bare marker the field used to be', () => {
    // The upgrade, pinned. The marker's first outing was a bare `'none'`
    // copied out of the doctrine before any lint ran, on the exact app the
    // rule existed to catch. A schema that still accepted the bare string
    // would leave that path open beside the new one.
    const spec = { ...validSpec(), memberInteraction: 'none' as never };
    expect(SurfaceSpecSchema.safeParse(spec).success).toBe(false);
  });

  test('a forked spec survives validation carrying its lineage', () => {
    // The third field declared for the same reason (D67, D72). Fork wrote
    // `provenance` from the day it shipped and was safe only because every
    // comparison on its write path happens to be raw-to-raw — a property of
    // those call sites, not of the field. Declaring it also makes lineage
    // readable off a validated spec, which is what the fork affordance in the
    // client needs in order to display anything.
    const provenance = {
      surfaceId: 'srf-source',
      specRevision: 3,
      sha256: 'a'.repeat(64),
      mode: 'copy' as const,
    };
    const parsed = SurfaceSpecSchema.parse({
      ...validSpec(),
      provenance,
      stillUnknown: true,
    });
    expect(parsed.provenance).toEqual(provenance);
    expect(parsed).not.toHaveProperty('stillUnknown');
  });

  test('the source channel is optional, and omitted stays omitted', () => {
    // Naming the source nest tells every member of the forker's group that a
    // channel by that name exists somewhere. Opt-in, so a schema that supplied
    // a default or required the field would make the disclosure automatic.
    const withChannel = SurfaceSpecSchema.parse({
      ...validSpec(),
      provenance: {
        surfaceId: 'srf-source',
        specRevision: 1,
        sha256: 'b'.repeat(64),
        channel: 'chat/~zod/dash-0001',
        mode: 'regenerated',
      },
    });
    expect(withChannel.provenance?.channel).toBe('chat/~zod/dash-0001');
    const without = SurfaceSpecSchema.parse({
      ...validSpec(),
      provenance: {
        surfaceId: 'srf-source',
        specRevision: 1,
        sha256: 'b'.repeat(64),
        mode: 'copy',
      },
    });
    expect(without.provenance).not.toHaveProperty('channel');
  });

  test('rejects lineage that is not a lineage', () => {
    // It is a claim and nothing verifies it, which is exactly why its SHAPE
    // has to be enforced: an unverifiable field with an unconstrained shape is
    // a place to put arbitrary member-visible text.
    for (const provenance of [
      {
        surfaceId: 'srf-source',
        specRevision: 1,
        sha256: 'short',
        mode: 'copy',
      },
      { surfaceId: '', specRevision: 1, sha256: 'c'.repeat(64), mode: 'copy' },
      {
        surfaceId: 'srf-source',
        specRevision: 0,
        sha256: 'c'.repeat(64),
        mode: 'copy',
      },
      {
        surfaceId: 'srf-source',
        specRevision: 1,
        sha256: 'c'.repeat(64),
        mode: 'forked',
      },
      { surfaceId: 'srf-source', specRevision: 1, sha256: 'c'.repeat(64) },
      'srf-source',
    ]) {
      const spec = { ...validSpec(), provenance: provenance as never };
      expect(SurfaceSpecSchema.safeParse(spec).success).toBe(false);
    }
  });

  test('rejects a marker with no reason, or an empty one', () => {
    for (const marker of [
      { mode: 'none' },
      { mode: 'none', because: '' },
      { mode: 'none', because: 42 },
    ]) {
      const spec = { ...validSpec(), memberInteraction: marker as never };
      expect(SurfaceSpecSchema.safeParse(spec).success).toBe(false);
    }
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
