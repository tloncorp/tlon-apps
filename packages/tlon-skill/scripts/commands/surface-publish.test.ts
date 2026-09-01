// The REAL schema, through a subpath: `bunfig.toml` preloads a process-wide
// mock of the `@tloncorp/api` root that does not carry the surface exports, and
// the whole point of the block at the bottom of this file is that the stripping
// is done by the schema production uses, not by a stand-in that would strip
// whatever the test wanted it to.
// @ts-expect-error -- subpath export not resolvable under moduleResolution:Node
import * as surfaceSchemasModule from '@tloncorp/api/client/surface/schemas';
import { describe, expect, it } from 'bun:test';

import { canonicalJson } from '../surface-canonical-json';
import {
  BEACH_TRIP_SPLIT_BUNDLE,
  BEACH_TRIP_SPLIT_SPEC,
  COMPLIANT_FIXTURE,
  RULE_FIXTURES,
} from '../surface-lint-fixtures';
import {
  REACHABILITY_CITED_CHECK,
  RUBRIC_CELL_IDS,
  UNCONDITIONAL_RUBRIC_CHECKS,
  reachabilityCitation,
  surfaceCanonicalHash,
} from '../surface-rubric-artifact';
import {
  type FakeShipOptions,
  createTestSurfaceDeps,
} from '../surface-test-doubles';
import { run } from './surface';
import { decideRevision, specContentKey } from './surface-publish';

const { SurfaceSpecSchema } = surfaceSchemasModule as Pick<
  typeof import('@tloncorp/api'),
  'SurfaceSpecSchema'
>;

const GROUP = '~zod/dashboards';
const CHANNEL = 'chat/~zod/dash-0001';
const BUNDLE_PATH = '/work/app.js';
const SPEC_PATH = '/work/spec.json';
const RUBRIC_PATH = '/work/rubric.json';

/**
 * A COMPLETE scoring sheet for a given app and bundle.
 *
 * Every field the validator requires, filled with distinguishable text — the
 * twelve observations differ from each other, because a sheet repeating one
 * string twelve times is refused on purpose and a fixture that tripped that
 * would turn every publish test into a test of the anti-degeneracy rule.
 */
function completedRubric(input: {
  surfaceId: string;
  bundleSha256: string;
  specSha256: string;
  /** the state the captures opened on; omit for the spec's own */
  stateOverride?: unknown;
  /** the spec, for the starting point a plain run would have opened on */
  initialState?: unknown;
}) {
  const cells: Record<string, string> = {};
  for (const id of RUBRIC_CELL_IDS) {
    cells[id] = `looked at ${id}; nothing cut off, copy reads as the group's`;
  }
  const checks: Record<string, unknown> = {};
  // The seven universal checks, which is the sheet `surface preview` emits for
  // an ordinary app. A conditional check is added by the test that needs it,
  // so a test asserting a conditional check is REQUIRED cannot be satisfied by
  // a helper that quietly filled it in.
  for (const check of UNCONDITIONAL_RUBRIC_CHECKS) {
    checks[check.id] = {
      verdict: 'pass',
      cell: RUBRIC_CELL_IDS[0],
      note: `check ${check.number} scored: ${check.title}`,
      // Check 7 carries preview's reachability line as well as the note, and
      // the validator requires it there. Built through `reachabilityCitation`
      // rather than hand-written, so this fixture cannot satisfy a marker rule
      // the real template writer would fail.
      ...(check.id === REACHABILITY_CITED_CHECK
        ? {
            reachability: reachabilityCitation({
              closed: true,
              nodeCount: 4,
              truncatedBy: [],
              shortfalls: [],
              findings: [],
            }),
          }
        : {}),
    };
  }
  const overridden = input.stateOverride !== undefined;
  return {
    version: 1,
    surfaceId: input.surfaceId,
    bundleSha256: input.bundleSha256,
    specSha256: input.specSha256,
    stateSource: overridden ? 'override' : 'spec-initial-state',
    stateSha256: surfaceCanonicalHash(
      overridden ? input.stateOverride : input.initialState
    ),
    cells,
    checks,
  };
}

/** The gate's own compliant fixture, minus the fields publish owns. */
function specFile(overrides: Record<string, unknown> = {}) {
  const base = { ...(COMPLIANT_FIXTURE.spec as Record<string, unknown>) };
  delete base.bundle;
  delete base.specRevision;
  return { ...base, ...overrides };
}

function setup(
  options: FakeShipOptions & {
    bundle?: string;
    spec?: Record<string, unknown>;
  } = {}
) {
  const harness = createTestSurfaceDeps(options);
  harness.ship.addGroup(GROUP);
  harness.ship.addChannel(GROUP, CHANNEL);
  harness.ship.files.set(
    BUNDLE_PATH,
    options.bundle ?? COMPLIANT_FIXTURE.bundleSource
  );
  const specValue = options.spec ?? specFile();
  harness.ship.files.set(SPEC_PATH, JSON.stringify(specValue, null, 2));
  restampRubric(harness);
  return harness;
}

/**
 * Scores the sheet against whatever the harness currently holds — "the author
 * ran `surface preview` on this pair and filled the template in".
 *
 * Bound to BOTH halves publish binds, through the same functions publish uses:
 * the bundle's bytes and the spec file's verbatim parse. Any test that edits
 * either has, correctly, invalidated its rubric; calling this is the test's way
 * of saying the repair round included a re-preview. That is what the tool
 * requires of a bundle change and, since the spec binding landed, of a
 * spec-only change too.
 */
function restampRubric(
  harness: ReturnType<typeof createTestSurfaceDeps>,
  /**
   * The state a `surface preview --state <file>` run substituted, when the test
   * is standing in for one. Omitted is the ordinary run: the captures opened on
   * the spec's own `initialState`.
   */
  stateOverride?: unknown
) {
  const spec = JSON.parse(harness.ship.files.get(SPEC_PATH) as string);
  harness.ship.files.set(
    RUBRIC_PATH,
    JSON.stringify(
      completedRubric({
        surfaceId: String(spec.surfaceId),
        bundleSha256: harness.deps.sha256Hex(
          harness.deps.readBinaryFile(BUNDLE_PATH)
        ),
        specSha256: surfaceCanonicalHash(spec),
        initialState: spec.initialState,
        ...(stateOverride === undefined ? {} : { stateOverride }),
      }),
      null,
      2
    )
  );
}

/**
 * The author edited the spec and re-ran preview, in that order.
 *
 * A spec-only edit invalidates the sheet — the twelve captures were rendered
 * under the older definition — so a revision that does not re-score is refused.
 * Almost every test here revises in order to exercise something downstream, so
 * they revise the way the tool requires; the handful that deliberately do NOT
 * re-score are the ones measuring the binding itself, and they call
 * `files.set` directly so the omission is visible at the call site.
 */
function revise(
  harness: ReturnType<typeof createTestSurfaceDeps>,
  spec: Record<string, unknown>
) {
  harness.ship.files.set(SPEC_PATH, JSON.stringify(spec));
  restampRubric(harness);
}

async function publish(
  harness: ReturnType<typeof setup>,
  extra: string[] = []
) {
  return run(
    [
      'publish',
      CHANNEL,
      '--bundle',
      BUNDLE_PATH,
      '--spec',
      SPEC_PATH,
      // Callers that are testing the rubric gate itself pass their own
      // --rubric in `extra`; parseSurfaceArgs takes the last value, so theirs
      // wins over this default.
      '--rubric',
      RUBRIC_PATH,
      '--json',
      ...extra,
    ],
    harness.deps
  );
}

function blobEntries(harness: ReturnType<typeof setup>): unknown[] {
  return (harness.ship.posts.get(CHANNEL) ?? []).flatMap((post) =>
    post.blob ? (JSON.parse(post.blob) as unknown[]) : []
  );
}

describe('specContentKey / decideRevision', () => {
  it('ignores the revision and the ordering of keys', () => {
    expect(specContentKey({ a: 1, b: 2, specRevision: 9 })).toBe(
      specContentKey({ b: 2, specRevision: 3, a: 1 })
    );
  });

  it('sees a hash change even when the revision would not move', () => {
    const current = {
      version: 1,
      surfaceId: 'srf',
      specRevision: 4,
      bundle: {
        assetRef: 'u',
        sha256: 'a'.repeat(64),
        size: 10,
        shellVersion: 1,
      },
      initialState: {},
      actions: {},
    } as never;
    const candidate = {
      version: 1,
      surfaceId: 'srf',
      specRevision: 4,
      bundle: {
        assetRef: 'u',
        sha256: 'b'.repeat(64),
        size: 10,
        shellVersion: 1,
      },
      initialState: {},
      actions: {},
    };
    expect(
      decideRevision({ spec: current, raw: JSON.stringify(current) }, candidate)
    ).toEqual({
      changed: true,
      revision: 5,
      previousRevision: 4,
    });
  });

  it('does not bump when the previous cell carries a key the schema strips', () => {
    // The class, not the instance. `duplicatesTolerated` is declared now, so
    // it can no longer demonstrate this — an undeclared key can. Keying the
    // previous side off the validated spec would drop `x-note`, make the
    // content differ, bump the revision, and reset live state.
    const stored = {
      version: 1,
      surfaceId: 'srf',
      specRevision: 4,
      title: 't',
      bundle: {
        assetRef: 'u',
        sha256: 'b'.repeat(64),
        size: 10,
        shellVersion: 1,
      },
      initialState: {},
      actions: {},
      'x-note': 'survives in the cell, stripped by the schema',
    };
    const { 'x-note': _stripped, ...validated } = stored;
    expect(
      decideRevision(
        { spec: validated as never, raw: JSON.stringify(stored) },
        stored
      )
    ).toEqual({
      changed: false,
      revision: 4,
      previousRevision: 4,
    });
  });

  it('starts at 1 when the channel has no definition yet', () => {
    expect(decideRevision(null, {})).toEqual({
      changed: true,
      revision: 1,
      previousRevision: null,
    });
  });
});

describe('surface publish — first publish', () => {
  it('gates, uploads, writes, observes, and mirrors', async () => {
    const harness = setup();
    expect(await publish(harness)).toBe(0);

    const result = harness.json();
    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.specRevision).toBe(1);
    expect(result.previousRevision).toBe(null);
    expect(result.uploaded).toBe(true);
    expect(result.byteIdentical).toBe(true);

    // The definition is on the ship, not merely poked.
    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.specRevision).toBe(1);
    expect(stored.bundle.sha256).toBe(result.sha256);
    expect(stored.bundle.assetRef).toBe(result.assetRef);

    // The bundle went to storage under its own hash.
    expect(harness.ship.uploads).toHaveLength(1);
    expect(harness.ship.uploads[0].fileName).toBe(`${result.sha256}.js`);

    // Exactly one mirror post, exactly one blob entry, right kind.
    const posts = harness.ship.posts.get(CHANNEL) ?? [];
    expect(posts).toHaveLength(1);
    expect(posts[0].kind).toBe('/chat/surface/spec');
    const entries = JSON.parse(posts[0].blob ?? '[]');
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('surface-spec-mirror');
    expect(entries[0].specRevision).toBe(1);
  });

  it('carries fallback text so a pre-surface client sees a message', async () => {
    const harness = setup();
    await publish(harness);
    // The fallback is the writer's responsibility; the fake records the post
    // only when one was supplied.
    expect(harness.ship.posts.get(CHANNEL)).toHaveLength(1);
  });
});

describe('surface publish — no-op versus bump', () => {
  it('republishing identical content is an explicit no-op', async () => {
    const harness = setup();
    await publish(harness);
    const first = harness.json();

    expect(await publish(harness)).toBe(0);
    const second = harness.json();

    expect(second.changed).toBe(false);
    expect(second.outcome).toBe('no-op');
    expect(second.specRevision).toBe(first.specRevision);
    expect(second.uploaded).toBe(false);
    // Nothing was written and nothing was posted the second time.
    expect(harness.ship.descriptionWrites).toHaveLength(1);
    expect(harness.ship.posts.get(CHANNEL)).toHaveLength(1);
    expect(harness.ship.uploads).toHaveLength(1);
  });

  it('is a no-op when an identical append-marked spec is republished', async () => {
    // The raw-vs-validated class. `decideRevision` keys the PREVIOUS spec off
    // the schema-validated read-back and the CANDIDATE off the raw assembled
    // object. Any field the schema drops is therefore present on one side of
    // the comparison and absent from the other, so an unchanged spec reads as
    // changed: the revision bumps, prior events stop folding, and — because
    // preservation defaults off — every live surface resets. `append` actions
    // are the ones that must carry `duplicatesTolerated` to pass the gate at
    // all, so this hits precisely the specs the marker exists for.
    // `specFile()` is a SHALLOW copy of the shared fixture, so `initialState`
    // and `actions` are still the corpus's own objects; clone before adding.
    const marked = structuredClone(specFile()) as Record<string, unknown>;
    (marked.initialState as Record<string, unknown>).log = [];
    (marked.actions as Record<string, unknown>)['add-note'] = {
      ops: [{ op: 'append', path: '/log', value: '$actor' }],
      duplicatesTolerated: true,
    };
    const harness = setup({ spec: marked });

    expect(await publish(harness)).toBe(0);
    const first = harness.json();
    expect(first.changed).toBe(true);
    expect(first.specRevision).toBe(1);

    expect(await publish(harness)).toBe(0);
    const second = harness.json();

    expect(second.changed).toBe(false);
    expect(second.outcome).toBe('no-op');
    expect(second.specRevision).toBe(1);
    expect(harness.ship.descriptionWrites).toHaveLength(1);
  });

  it('is a no-op even when the spec file reorders its keys', async () => {
    const harness = setup();
    await publish(harness);

    const reordered = specFile();
    // Written WITHOUT re-scoring, on purpose. Key order is not content, so the
    // sheet's spec hash does not move for it either — if it did, this publish
    // would refuse as `rubric-mismatch` long before it could report a no-op,
    // and the binding would be inventing revisions the same way a naive
    // `JSON.stringify` comparison would (D109).
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(Object.fromEntries(Object.entries(reordered).reverse()))
    );
    expect(await publish(harness)).toBe(0);
    expect(harness.json().changed).toBe(false);
  });

  it('bumps when the bundle bytes change, and re-uploads', async () => {
    const harness = setup();
    await publish(harness);
    const first = harness.json();

    harness.ship.files.set(
      BUNDLE_PATH,
      `${COMPLIANT_FIXTURE.bundleSource}\n// a comment that changes the bytes\n`
    );
    restampRubric(harness);
    expect(await publish(harness)).toBe(0);
    const second = harness.json();

    expect(second.changed).toBe(true);
    expect(second.specRevision).toBe(2);
    expect(second.previousRevision).toBe(1);
    expect(second.sha256).not.toBe(first.sha256);
    expect(harness.ship.uploads).toHaveLength(2);

    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.specRevision).toBe(2);
    expect(stored.bundle.sha256).toBe(second.sha256);
  });

  it('bumps on a spec-only change without re-uploading unchanged bytes', async () => {
    const harness = setup();
    await publish(harness);
    const first = harness.json();

    revise(harness, specFile({ title: 'Potluck, renamed' }));
    expect(await publish(harness)).toBe(0);
    const second = harness.json();

    expect(second.changed).toBe(true);
    expect(second.specRevision).toBe(2);
    expect(second.uploaded).toBe(false);
    expect(second.assetRef).toBe(first.assetRef);
    expect(harness.ship.uploads).toHaveLength(1);
  });

  it('ignores a revision number written into the spec file', async () => {
    const harness = setup({ spec: specFile({ specRevision: 47 }) });
    await publish(harness);
    expect(harness.json().specRevision).toBe(1);

    revise(harness, specFile({ specRevision: 47, title: 'Renamed' }));
    await publish(harness);
    expect(harness.json().specRevision).toBe(2);
  });

  it('re-uploads on request without pretending the definition changed', async () => {
    const harness = setup();
    await publish(harness);
    expect(await publish(harness, ['--reupload'])).toBe(0);

    const result = harness.json();
    expect(result.changed).toBe(false);
    expect(result.uploaded).toBe(true);
    expect(harness.ship.uploads).toHaveLength(2);
    expect(harness.ship.descriptionWrites).toHaveLength(1);
  });
});

describe('surface publish — the gate is the boundary', () => {
  it('refuses a bundle the gate rejects, before uploading anything', async () => {
    const forbidden = RULE_FIXTURES.find(
      (fixture) => fixture.rule === 'forbidden-api'
    );
    if (!forbidden)
      throw new Error('the gate fixture corpus lost forbidden-api');

    const harness = setup({ bundle: forbidden.bundleSource });
    expect(await publish(harness)).toBe(1);

    const result = harness.json();
    expect(result.code).toBe('lint-failed');
    const violations = (result.details as Record<string, unknown>)
      .violations as { rule: string }[];
    expect(violations.some((entry) => entry.rule === 'forbidden-api')).toBe(
      true
    );
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.descriptionWrites).toHaveLength(0);
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);
  });
});

describe('surface publish — observation', () => {
  /**
   * The dangerous half is not a write that vanishes — that one is obvious.
   * It is a write the ship accepts and then overwrites with a superseded
   * definition (D59: a routine metadata edit rebuilding the description
   * from a stale payload). The cell still holds a perfectly valid spec, so
   * only comparing the CONTENT catches it.
   */
  it('refuses when the ship kept a different definition than the one written', async () => {
    const harness = setup({
      rewriteDescriptionOnWrite: (_incoming, stored) => stored,
    });
    // First publish lands normally, so the channel holds revision 1.
    harness.ship.groups.get(GROUP)!.channels[CHANNEL].meta.description =
      JSON.stringify({
        surfaceSpec: {
          version: 1,
          surfaceId: 'srf-potluck',
          specRevision: 1,
          bundle: {
            assetRef: 'https://storage.example/old.js',
            sha256: 'b'.repeat(64),
            size: 10,
            shellVersion: 1,
          },
          initialState: {},
          actions: {},
        },
      });

    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('publish-unconfirmed');
    expect(
      String((result.details as Record<string, unknown>).observed)
    ).toContain('not what was written');
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);
  });

  it('refuses to report success when the ship never took the write', async () => {
    const harness = setup({ swallowDescriptionWrite: true });
    expect(await publish(harness)).toBe(1);

    const result = harness.json();
    expect(result.code).toBe('publish-unconfirmed');
    // The write was attempted and the mirror was NOT posted on top of it.
    expect(harness.ship.descriptionWrites).toHaveLength(1);
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);
  });
});

describe('surface publish — surface identity', () => {
  it('refuses to orphan a channel state by changing surfaceId', async () => {
    const harness = setup();
    await publish(harness);

    revise(harness, specFile({ surfaceId: 'srf-something-else' }));
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('surface-id-changed');

    expect(await publish(harness, ['--allow-surface-id-change'])).toBe(0);
    expect(harness.json().specRevision).toBe(2);
  });
});

describe('surface publish — preserving state', () => {
  function withHistory() {
    const harness = setup();
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      blob: JSON.stringify([
        {
          type: 'surface-event',
          version: 1,
          surfaceId: 'srf-potluck',
          specRevision: 1,
          mode: 'host',
          ops: [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }],
        },
      ]),
      kind: '/chat/surface/event',
    });
    return harness;
  }

  it('posts the migration snapshot in the same command', async () => {
    const harness = withHistory();
    // Revision 1 first, so there is a real fold to carry forward.
    await publish(harness);
    revise(harness, specFile({ title: 'Potluck v2' }));

    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    const result = harness.json();
    expect(result.specRevision).toBe(2);
    expect(result.preserveState).toBe(true);

    const snapshot = blobEntries(harness).find(
      (entry) => (entry as { type?: string }).type === 'surface-snapshot'
    ) as Record<string, unknown> | undefined;
    expect(snapshot).toBeDefined();
    expect(snapshot?.specRevision).toBe(2);
    // The state folded under the OLD definition, carried across.
    expect(snapshot?.state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });

    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.preserveState).toBe(true);
  });

  it('carries gate-only markers through to the stored definition', async () => {
    // Both gate markers are declared on the schema now
    // (`packages/api/src/client/surface/schemas.ts`), so both would survive
    // validation on their own. That makes them the wrong subject for the
    // property this test is actually about, which is that publish writes the
    // RAW assembled object and uses the schema check purely as a check.
    //
    // So an undeclared key rides along. If the write ever becomes
    // `write(schemaCheck.value)`, `z.object` strips it and the assertion
    // below is what notices — before some future marker is added to the gate,
    // not after it has silently vanished from a published definition and the
    // next revise cycle has re-linted a spec that lost its opt-out.
    const harness = withHistory();
    const marked = specFile();
    const firstAction = Object.keys(
      (marked as { actions: Record<string, unknown> }).actions
    )[0];
    (marked as { actions: Record<string, Record<string, unknown>> }).actions[
      firstAction
    ].duplicatesTolerated = true;
    (marked as Record<string, unknown>).aKeyNoSchemaDeclares = 'survives';
    revise(harness, marked);

    expect(await publish(harness)).toBe(0);

    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.actions[firstAction].duplicatesTolerated).toBe(true);
    expect(stored.aKeyNoSchemaDeclares).toBe('survives');
  });

  /**
   * The stranding sequence, end to end.
   *
   * A live state between the old snapshot cap and the reducer's own cap was
   * legal to hold and impossible to write down. Publish folded it, moved the
   * definition to a preserving revision, mirrored that, and only then
   * discovered the snapshot would not validate — leaving the channel on a
   * revision whose migration snapshot nobody could post. Every exit was
   * blocked: an exact retry took the no-op path, `surface snapshot` refused a
   * pending revision, and a further preserving publish cannot migrate off a
   * pending one either. The only escape discarded the state.
   *
   * Nothing here abuses a cap to reach the band: eighteen host events, one op
   * each, every op under the 4 KB op-value cap and every entry under the 8 KB
   * entry cap.
   */
  function addLargeState(harness: ReturnType<typeof setup>) {
    for (let index = 0; index < 18; index += 1) {
      harness.ship.addPost(CHANNEL, {
        authorId: '~zod',
        kind: '/chat/surface/event',
        blob: JSON.stringify([
          {
            type: 'surface-event',
            version: 1,
            surfaceId: 'srf-potluck',
            specRevision: 1,
            mode: 'host',
            ops: [
              { op: 'set', path: `/bulk/k${index}`, value: 'x'.repeat(3800) },
            ],
          },
        ]),
      });
    }
  }

  it('preserves a legal state that is larger than a snapshot used to hold', async () => {
    const harness = setup();
    // Revision 1 exists first, so the host events below are tagged with the
    // revision they actually fold under.
    expect(await publish(harness)).toBe(0);
    addLargeState(harness);

    // The premise: a state the reducer really holds, above where the snapshot
    // cap used to sit and below the cap the reducer itself enforces.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const folded = harness.json();
    expect(folded.status).toBe('reduced');
    const size = JSON.stringify(folded.state).length;
    expect(size).toBeGreaterThan(64 * 1024);
    expect(size).toBeLessThan(128 * 1024);
    expect(folded.stateFull).toBe(false);

    // A title-only preserving revision — the smallest possible change.
    revise(harness, specFile({ title: 'Potluck, renamed' }));
    expect(await publish(harness, ['--preserve-state'])).toBe(0);

    const result = harness.json();
    expect(result.outcome).toBe('published');
    expect(result.specRevision).toBe(2);
    const snapshot = result.snapshot as Record<string, unknown> | null;
    expect(snapshot).not.toBeNull();

    // And the channel is usable at the new revision, not migration-pending.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const after = harness.json();
    expect(after.status).toBe('reduced');
    expect(after.specRevision).toBe(2);
    expect(JSON.stringify(after.state).length).toBe(size);
  });

  /**
   * The ordering property, independent of any cap: if the migration snapshot
   * will not validate, the pending window must never open. The failure is
   * forced through the validator rather than through a size, because after
   * the caps were aligned no legal state can produce it — and the property
   * being pinned is the ORDER, not the cap that first exposed it.
   */
  it('writes nothing when the migration snapshot cannot be validated', async () => {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    addLargeState(harness);
    const writesAfterFirstPublish = harness.ship.descriptionWrites.length;
    const postsAfterFirstPublish = (harness.ship.posts.get(CHANNEL) ?? [])
      .length;

    const real = harness.deps.validateEntry;
    harness.deps.validateEntry = (kind, value) =>
      kind === 'snapshot'
        ? { ok: false, issues: ['snapshot state exceeds 65536 bytes'] }
        : real(kind, value);

    revise(harness, specFile({ title: 'Potluck, renamed' }));
    expect(await publish(harness, ['--preserve-state'])).toBe(1);

    const result = harness.json();
    // Not an author-error code: the spec file and the ops are both fine.
    expect(result.code).toBe('state-too-large');
    expect((result.details as Record<string, unknown>).errorClass).toBe(
      'environment'
    );
    // And nothing was published, so the error must not claim otherwise.
    expect(
      (result.details as Record<string, unknown>).definitionPublished
    ).toBeUndefined();

    // The description never moved, and no mirror was posted on top of it.
    expect(harness.ship.descriptionWrites).toHaveLength(
      writesAfterFirstPublish
    );
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(
      postsAfterFirstPublish
    );
    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.specRevision).toBe(1);
    expect(stored.preserveState).toBeUndefined();
  });

  it('refuses when the definition it would migrate from is itself pending', async () => {
    // Revision 1 lands first: this test is about migrating off a PENDING
    // revision, so the definition being migrated from has to be one the
    // command can read. (It used to reach this through a preserving first
    // publish over an unreadable definition — the case immediately below,
    // which now refuses for a different reason and would have made this
    // assertion pass without ever exercising what it names.)
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      kind: '/chat/surface/event',
      blob: JSON.stringify([
        {
          type: 'surface-event',
          version: 1,
          surfaceId: 'srf-potluck',
          specRevision: 1,
          mode: 'host',
          ops: [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }],
        },
      ]),
    });

    revise(harness, specFile({ title: 'Potluck v2' }));
    expect(await publish(harness, ['--preserve-state'])).toBe(0);

    // The revision-2 snapshot exists; retract it by hand so the surface is
    // migration-pending, then try to migrate off it.
    const snapshotPost = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    expect(snapshotPost).toBeDefined();
    snapshotPost!.isEdited = true;

    revise(harness, specFile({ title: 'Potluck v3' }));
    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    expect(harness.json().code).toBe('migration-pending');
  });
});

/**
 * A preserving publish over a channel whose definition cannot be read.
 *
 * There is nothing to fold the channel's existing events under — that is what
 * "no readable definition" means — so there is no state to carry across, and
 * the two answers that do not involve reading one are both wrong. Freezing
 * (pair `initialState` with the newest sequence) tells every later fold that
 * the events below it are already incorporated, and they are not: they are
 * gone, unreplayable and unretractable. Replaying (pair `initialState` with
 * boundary 0) runs events written for one definition against a different one.
 *
 * `surface snapshot`'s repair path already refuses precisely this — "the
 * channel holds events from an earlier revision but no mirror of that revision
 * to fold them under. Reconstructing the state would mean guessing at it" —
 * and the two paths facing the same situation must not disagree.
 */
describe('surface publish — preserving over a definition it cannot read', () => {
  function hostEventBlob(sequenceTag = 1) {
    return JSON.stringify([
      {
        type: 'surface-event',
        version: 1,
        surfaceId: 'srf-potluck',
        specRevision: sequenceTag,
        mode: 'host',
        ops: [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }],
      },
    ]);
  }

  it('refuses rather than freeze the events it cannot fold', async () => {
    const harness = setup();
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      kind: '/chat/surface/event',
      blob: hostEventBlob(),
    });

    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('migration-pending');
    expect(String(result.message)).toContain('guessing at it');

    // Nothing moved: no definition was written, and no snapshot claiming to
    // cover that event was posted.
    expect(harness.ship.descriptionWrites).toHaveLength(0);
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(1);
  });

  it('refuses over an existing snapshot it cannot read the definition of', async () => {
    const harness = setup();
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      kind: '/chat/surface/snapshot',
      blob: JSON.stringify([
        {
          type: 'surface-snapshot',
          version: 1,
          surfaceId: 'srf-potluck',
          specRevision: 1,
          upToSequenceNum: 0,
          state: { bringing: { '~ten': 'pie' } },
        },
      ]),
    });

    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    expect(harness.json().code).toBe('migration-pending');
  });

  it('carries the starting state when there is no surface history at all', async () => {
    const harness = setup();
    // Ordinary chat, not surface records: nothing here folds, so the new
    // definition's own starting point is the true answer rather than a
    // default — the same answer the repair path gives in the same situation.
    harness.ship.addPost(CHANNEL, { authorId: '~zod', kind: '/chat' });

    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    const snapshot = blobEntries(harness).find(
      (entry) => (entry as { type?: string }).type === 'surface-snapshot'
    ) as Record<string, unknown> | undefined;
    expect(snapshot).toBeDefined();
    expect(snapshot?.state).toEqual({ bringing: { '~zod': 'bread' } });
    // The boundary is what the state covers, which is nothing — not the
    // newest post in the channel. A boundary of 1 would claim the chat post's
    // sequence, and any surface event that arrived at it would be frozen out.
    expect(snapshot?.upToSequenceNum).toBe(0);

    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().status).toBe('reduced');
  });

  it('does not count a retracted record as history it must fold', async () => {
    const harness = setup();
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      kind: '/chat/surface/event',
      blob: hostEventBlob(),
      isEdited: true,
    });

    // An edited surface post is retracted: every reducer drops it, so there
    // is no folded state behind it to guess at and no reason to refuse.
    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    const snapshot = blobEntries(harness).find(
      (entry) => (entry as { type?: string }).type === 'surface-snapshot'
    ) as Record<string, unknown> | undefined;
    expect(snapshot?.state).toEqual({ bringing: { '~zod': 'bread' } });
    expect(snapshot?.upToSequenceNum).toBe(0);
  });
});

/**
 * The asymmetry this block exists for.
 *
 * `surface snapshot` refuses to write over a fold that stopped early, and so
 * does the repair `surface publish` reaches on its retry path. The PRIMARY
 * preserving publish — the path a host actually takes — folded the same
 * history and snapshotted it without a word. The entries it froze are tagged
 * with a revision that no longer folds, so nobody can re-post them: the same
 * loss the other two paths refuse to cause, reached by the ordinary route.
 *
 * The fold is checked before the definition moves, so refusing here cannot
 * strand the channel the way a mid-publish failure can: nothing has been
 * written when the refusal is raised.
 */
describe('surface publish — the primary preserving path and aborted entries', () => {
  /**
   * Two entries that stop early, at sequences 11 and 17 — neither adjacent to
   * each other nor at either end of the history, with clean entries before,
   * between and after them. An enumeration that is off by one, or that reports
   * every folded entry, or that reports none, all read differently from
   * `[11, 17]`.
   *
   * `/bringing/~zod` holds the string "bread", so writing THROUGH it is a
   * `structure` refusal. The second op of each aborting entry is perfectly
   * good and never applies, which is what makes the abort observable in the
   * folded state rather than only in a counter.
   */
  function abortingOps(dish: string) {
    return [
      { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
      { op: 'set', path: '/bringing/~0bus', value: dish },
    ];
  }

  function withAbortedHistory(harness: ReturnType<typeof setup>) {
    const event = (sequenceNum: number, ops: unknown[]) =>
      harness.ship.addPost(CHANNEL, {
        authorId: '~zod',
        kind: '/chat/surface/event',
        sequenceNum,
        blob: JSON.stringify([
          {
            type: 'surface-event',
            version: 1,
            surfaceId: 'srf-potluck',
            specRevision: 1,
            mode: 'host',
            ops,
          },
        ]),
      });
    event(5, [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }]);
    event(11, abortingOps('never-applies-a'));
    event(12, [{ op: 'set', path: '/bringing/~0wes', value: 'cake' }]);
    event(17, abortingOps('never-applies-b'));
    event(23, [{ op: 'set', path: '/bringing/~0nec', value: 'soup' }]);
  }

  /** Revision 1 published, then the history above written under it. */
  async function withAborts() {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    withAbortedHistory(harness);
    revise(harness, specFile({ title: 'Potluck v2' }));
    return harness;
  }

  /**
   * The premise, before anything is asserted about refusals: the double really
   * does produce two aborted entries, at the two sequences chosen, and the ops
   * written after each refusal really did not apply — `~bus` is absent from a
   * state that has every clean entry in it.
   */
  it('the fixture aborts exactly twice, at 11 and 17', async () => {
    const harness = await withAborts();
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const folded = harness.json();
    expect(folded.state).toEqual({
      bringing: {
        '~zod': 'bread',
        '~ten': 'pie',
        '~wes': 'cake',
        '~nec': 'soup',
      },
    });
    expect(folded.abortedSequenceNums).toEqual([11, 17]);
  });

  it('refuses rather than freeze the prefix, and teaches the flag', async () => {
    const harness = await withAborts();
    const writes = harness.ship.descriptionWrites.length;

    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('usage');
    expect(String(result.message)).toContain('--allow-aborted-events');

    // Pre-write, so the refusal cannot itself strand the channel: the
    // definition never moved and no snapshot was posted.
    expect(harness.ship.descriptionWrites).toHaveLength(writes);
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(0);
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().specRevision).toBe(1);
  });

  /**
   * The refusal names the posts, so the host reading it can go and look at
   * them, and it teaches the flag on the command they actually ran rather
   * than sending them to a different one.
   */
  it('names the aborted sequences in the refusal', async () => {
    const harness = await withAborts();
    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    const result = harness.json();
    expect(String(result.message)).toContain('entries at sequences 11, 17');
    expect(String(result.message)).toContain(`tlon surface state ${CHANNEL}`);
    expect(String(result.message)).toContain(
      'pass --allow-aborted-events to publish over the prefix as it stands'
    );
    expect(
      (result.details as Record<string, unknown>).abortedSequenceNums
    ).toEqual([11, 17]);
  });

  /**
   * The escape hatch leaves an audit trail, not a silence (D99). The flag is
   * the last moment anything can name these entries: the snapshot it permits
   * puts both under the boundary, and every fold after it reports a clean
   * history — which the tail of this test demonstrates rather than asserts by
   * assumption.
   */
  it('enumerates what the flag waived through, in JSON and in the report', async () => {
    const harness = await withAborts();
    expect(
      await publish(harness, ['--preserve-state', '--allow-aborted-events'])
    ).toBe(0);
    const result = harness.json();
    expect(result.outcome).toBe('published');
    const snapshot = result.snapshot as Record<string, unknown> | null;
    expect(snapshot?.abortedSequenceNums).toEqual([11, 17]);

    const plain = await withAborts();
    expect(
      await run(
        [
          'publish',
          CHANNEL,
          '--bundle',
          BUNDLE_PATH,
          '--spec',
          SPEC_PATH,
          '--rubric',
          RUBRIC_PATH,
          '--preserve-state',
          '--allow-aborted-events',
        ],
        plain.deps
      )
    ).toBe(0);
    expect(plain.out()).toContain(
      '2 entries at sequences 11, 17 stopped early and were checkpointed anyway'
    );

    // What the flag bought, and what it cost: the channel is live at the new
    // revision, and nothing reports the loss any more.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const after = harness.json();
    expect(after.specRevision).toBe(2);
    expect(after.abortedSequenceNums).toEqual([]);
  });
});

/**
 * The description write is not transactional with the posts that follow it, so
 * a preserving publish can land its definition and its mirror and then fail
 * before the migration snapshot — a crash, a dropped connection, a rejected
 * poke, anything at all. What that leaves is a channel on a preserving
 * revision with no snapshot at it: `surface state` says `migration-pending`
 * and shows no state, and every client renders the same.
 *
 * The exact retry an automated caller makes next used to take the
 * byte-identical no-op path, which runs BEFORE anything checks the channel's
 * health, and report `{ok: true, changed: false, outcome: "no-op"}`. The loop
 * reads success and stops, on a dashboard nobody can use.
 */
describe('surface publish — an exact retry over a stranded channel', () => {
  function withEvent(
    harness: ReturnType<typeof setup>,
    ops: unknown[] = [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }]
  ) {
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      kind: '/chat/surface/event',
      blob: JSON.stringify([
        {
          type: 'surface-event',
          version: 1,
          surfaceId: 'srf-potluck',
          specRevision: 1,
          mode: 'host',
          ops,
        },
      ]),
    });
  }

  /**
   * Revision 2 published and mirrored; its migration snapshot never landed.
   *
   * `strandExtra` exists because the primary preserving path now refuses over
   * an aborted fold: a channel cannot be stranded WITH one unless the publish
   * that stranded it waived the aborts on the way past. That is the only route
   * to this state, and it is the one the retry-path tests take.
   */
  async function stranded(ops?: unknown[], strandExtra: string[] = []) {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    withEvent(harness, ops);
    revise(harness, specFile({ title: 'Potluck v2' }));

    // The poke for the snapshot resolves and nothing lands — the D50 shape,
    // and the same thing a crash between the two writes leaves behind.
    const send = harness.deps.sendSurfacePost;
    harness.deps.sendSurfacePost = async (input) => {
      if (input.kindTail === 'surface/snapshot') return;
      return send(input);
    };
    expect(await publish(harness, ['--preserve-state', ...strandExtra])).toBe(
      1
    );
    expect(harness.json().code).toBe('post-unconfirmed');
    harness.deps.sendSurfacePost = send;

    // The premise: the definition moved, the mirror landed, and the channel
    // is unusable.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().status).toBe('migration-pending');
    return harness;
  }

  /**
   * A channel whose history cannot be paged back to its start: the newest
   * page comes back, and every page after it is empty while still claiming
   * there is more.
   */
  function truncateHistory(harness: ReturnType<typeof setup>) {
    const readPage = harness.deps.readPostPage;
    harness.deps.readPostPage = async (input) => {
      const page = await readPage(input);
      if (input.mode === 'newest') {
        return { ...page, posts: page.posts.slice(0, 1), older: 'truncated' };
      }
      return { posts: [], older: 'truncated', totalPosts: page.totalPosts };
    };
  }

  it('posts the missing snapshot instead of reporting success over it', async () => {
    const harness = await stranded();

    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    const result = harness.json();
    expect(result.outcome).toBe('migration-repaired');
    expect(result.changed).toBe(false);
    expect(result.specRevision).toBe(2);
    const snapshot = result.snapshot as Record<string, unknown> | null;
    expect(snapshot).not.toBeNull();
    expect(snapshot?.carriedFromRevision).toBe(1);

    // And the channel is live again, holding what revision 1 folded to.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const after = harness.json();
    expect(after.status).toBe('reduced');
    expect(after.specRevision).toBe(2);
    expect(after.state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });
  });

  it('leaves a healthy channel an ordinary no-op', async () => {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    withEvent(harness);
    revise(harness, specFile({ title: 'Potluck v2' }));
    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    const posts = (harness.ship.posts.get(CHANNEL) ?? []).length;

    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    const result = harness.json();
    expect(result.outcome).toBe('no-op');
    // A second snapshot at the same revision is not a repair, it is noise the
    // fold has to arbitrate.
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(posts);
    expect(harness.ship.descriptionWrites).toHaveLength(2);
  });

  it('is still a plain no-op when the revision preserves nothing', async () => {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    const posts = (harness.ship.posts.get(CHANNEL) ?? []).length;

    expect(await publish(harness)).toBe(0);
    expect(harness.json().outcome).toBe('no-op');
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(posts);
  });

  it('refuses the repair from anyone but the channel host', async () => {
    const harness = await stranded();
    // Only the host's snapshot is honoured by the fold, so a repair from
    // anyone else would report a fix that no client will ever see.
    harness.deps.actingShip = () => '~ten';

    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('migration-pending');
    expect(String(result.message)).toContain('only its host ~zod');
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(0);
  });

  it('refuses when the history it would fold cannot be read to its start', async () => {
    const harness = await stranded();
    // A repair folded over a truncated history freezes the wrong state
    // permanently — and "no-op, all is well" over a channel that may be
    // stranded is the claim this whole path exists to stop making.
    truncateHistory(harness);

    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    expect(harness.json().code).toBe('partial-hydration');
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(0);
  });

  it('refuses to finalize an aborted entry, and teaches the flag', async () => {
    // The state being carried across would be the partial prefix of an entry
    // that stopped early, so this repair would freeze the prefix and put the
    // failed entry under the boundary. The refusal teaches the flag on the
    // command the host is already running rather than deciding on their
    // behalf — or sending them to a different command to lift a refusal this
    // one raised.
    const harness = await stranded(
      [
        { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
        { op: 'set', path: '/bringing/~0ten', value: 'pie' },
      ],
      ['--allow-aborted-events']
    );

    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('usage');
    expect(String(result.message)).toContain('entry at sequence 2');
    expect(String(result.message)).toContain(
      'pass --allow-aborted-events to publish over the prefix as it stands'
    );
    expect(
      (result.details as Record<string, unknown>).abortedSequenceNums
    ).toEqual([2]);
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(0);
  });

  it('repairs under the flag, and names what it waived through', async () => {
    const harness = await stranded(
      [
        { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
        { op: 'set', path: '/bringing/~0ten', value: 'pie' },
      ],
      ['--allow-aborted-events']
    );

    expect(
      await publish(harness, ['--preserve-state', '--allow-aborted-events'])
    ).toBe(0);
    const result = harness.json();
    expect(result.outcome).toBe('migration-repaired');
    const snapshot = result.snapshot as Record<string, unknown> | null;
    expect(snapshot?.abortedSequenceNums).toEqual([2]);
  });

  it('still reports a no-op when a short read already proves the channel healthy', async () => {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    withEvent(harness);
    revise(harness, specFile({ title: 'Potluck v2' }));
    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    // A snapshot at the current revision is conclusive wherever it is found,
    // so a history that cannot be paged to its start is no reason to refuse a
    // republish of a channel that is demonstrably fine.
    truncateHistory(harness);

    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    expect(harness.json().outcome).toBe('no-op');
  });
});

/**
 * The control on the RULE, not on the check that enforces it.
 *
 * `surface-comparison-convention.test.ts` proves the convention is followed.
 * That is worth nothing unless following it prevents something, and nothing in
 * a convention check can establish that — so this block demonstrates the defect
 * D72 describes, using the real `SurfaceSpecSchema`.
 *
 * The mechanism is `z.object`'s strip-unknown-keys behaviour, and it is the
 * fulcrum every assertion here turns on: declaring `x-gate-marker` in
 * `SurfaceSpecSchema`, or switching the schema to `.passthrough()`, would make
 * the validated views differ and turn the "compares equal" assertions red. The
 * key is chosen to be one nobody will ever declare, so the fulcrum can only be
 * moved deliberately.
 */
describe('D72 — why the comparison has to be raw-to-raw', () => {
  const BASE = {
    version: 1,
    surfaceId: 'srf-d72',
    specRevision: 1,
    bundle: {
      assetRef: 'https://storage.example/app.js',
      sha256: 'a'.repeat(64),
      size: 10,
      shellVersion: 1,
    },
    initialState: {},
    actions: {
      vote: { ops: [{ op: 'set', path: '/votes/$actor', value: 'yes' }] },
    },
  } as const;

  const raw = (marker: string): Record<string, unknown> =>
    structuredClone({ ...BASE, 'x-gate-marker': marker }) as Record<
      string,
      unknown
    >;

  const validated = (spec: Record<string, unknown>): Record<string, unknown> =>
    SurfaceSpecSchema.parse(spec) as unknown as Record<string, unknown>;

  it('the schema really does strip the key the two specs differ in', () => {
    // Without this the block would be vacuous in the worst way: two specs
    // differing in a key the schema KEEPS would compare unequal on both sides
    // and every assertion below would pass while proving nothing.
    const parsed = validated(raw('alpha'));
    expect('x-gate-marker' in parsed).toBe(false);
    expect(canonicalJson(raw('alpha'))).not.toBe(canonicalJson(raw('omega')));
  });

  it('two different definitions compare EQUAL once both sides are validated', () => {
    // The defect. A gate that read both sides through the schema would report
    // "no change" for a definition that changed, and "confirmed" for a write
    // that landed something else.
    expect(canonicalJson(validated(raw('alpha')))).toBe(
      canonicalJson(validated(raw('omega')))
    );
    expect(specContentKey(validated(raw('alpha')))).toBe(
      specContentKey(validated(raw('omega')))
    );
  });

  it('the raw cells tell them apart, and decideRevision therefore bumps', () => {
    expect(specContentKey(raw('alpha'))).not.toBe(specContentKey(raw('omega')));
    expect(
      decideRevision(
        {
          spec: validated(raw('alpha')) as never,
          raw: JSON.stringify(raw('alpha')),
        },
        raw('omega')
      )
    ).toEqual({ changed: true, revision: 2, previousRevision: 1 });
  });

  it('strips inside an action too, which is where the marker used to live', () => {
    const withMarker = (value: string) => {
      const spec = structuredClone(BASE) as Record<string, unknown>;
      (spec.actions as Record<string, Record<string, unknown>>).vote[
        'x-gate-marker'
      ] = value;
      return spec;
    };
    expect(
      'x-gate-marker' in
        (
          validated(withMarker('alpha')).actions as Record<
            string,
            Record<string, unknown>
          >
        ).vote
    ).toBe(false);
    expect(canonicalJson(withMarker('alpha'))).not.toBe(
      canonicalJson(withMarker('omega'))
    );
    expect(canonicalJson(validated(withMarker('alpha')))).toBe(
      canonicalJson(validated(withMarker('omega')))
    );
  });

  it('publish refuses to confirm a write the ship stripped on the way in', async () => {
    // End to end, at the site the rule protects. The ship stores a
    // schema-validated copy of what was written — the shape any middlebox that
    // "cleans up" a payload would produce — so the definition on the channel is
    // NOT the definition publish assembled.
    const marked = { ...specFile(), 'x-gate-marker': 'alpha' };
    const harness = setup({
      spec: marked,
      rewriteDescriptionOnWrite: (incoming) => {
        const payload = JSON.parse(incoming) as Record<string, unknown>;
        payload.surfaceSpec = SurfaceSpecSchema.parse(payload.surfaceSpec);
        return JSON.stringify(payload);
      },
    });

    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('publish-unconfirmed');
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);

    // Both arms of the counterfactual, on the actual bytes: the raw cells
    // differ (which is why the refusal happened) and the validated views do
    // not (which is why a validated comparison would have reported success and
    // gone on to mirror a definition the channel does not hold).
    const written = JSON.parse(harness.ship.descriptionWrites[0].description)
      .surfaceSpec as Record<string, unknown>;
    const stored = JSON.parse(
      harness.ship.channelSpecText(CHANNEL) ?? '{}'
    ) as Record<string, unknown>;
    expect(written['x-gate-marker']).toBe('alpha');
    expect(canonicalJson(written)).not.toBe(canonicalJson(stored));
    expect(canonicalJson(validated(written))).toBe(
      canonicalJson(validated(stored))
    );
  });
});

/* ------------------------------------------------------------------ */
/* the rubric forcing function                                         */
/* ------------------------------------------------------------------ */

/**
 * **The fulcrum is the number of filled entries in the scoring sheet.** In this
 * test's world the only thing that can move it is the file at RUBRIC_PATH, and
 * both arms are built from the SAME `completedRubric()` fixture for the same
 * bundle — the refusing arm is that object with three cell observations
 * emptied and nothing else touched.
 *
 * That construction is load-bearing. An "incomplete" arm that was also
 * malformed, or scored a different app, would let the refusal fire for a
 * reason that has nothing to do with completeness, and the guard would look
 * identical whether it checked completeness or not.
 */
describe('surface publish — refuses without a completed rubric', () => {
  it('refuses when no rubric is offered at all', async () => {
    const harness = setup();
    expect(
      await run(
        [
          'publish',
          CHANNEL,
          '--bundle',
          BUNDLE_PATH,
          '--spec',
          SPEC_PATH,
          '--json',
        ],
        harness.deps
      )
    ).toBe(1);
    expect(harness.json().code).toBe('usage');
    expect(String(harness.json().message)).toContain('--rubric is required');
    // Nothing reached the ship.
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  it('refuses an INCOMPLETE sheet, names the cells, and writes nothing', async () => {
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    sheet.cells['phone-populated-dark'] = '';
    sheet.cells['desktop-initial-light'] = '';
    sheet.cells['phone-full-populated-light'] = '';
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));

    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-incomplete');
    const message = String(result.message);
    expect(message).toContain('3 of the twelve capture cells');
    expect(message).toContain('phone-populated-dark');
    expect(message).toContain('Nothing was uploaded or written');
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  it('publishes when those same three cells are filled in', async () => {
    // The other arm: byte-identical bundle, byte-identical spec, the same
    // sheet with the three observations written. If the refusal above had
    // been about anything other than completeness, this would refuse too.
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    sheet.cells['phone-populated-dark'] = '';
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-incomplete');

    sheet.cells['phone-populated-dark'] =
      'dark, three members listed, the tally still reads at a glance';
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
    expect(await publish(harness)).toBe(0);
    expect(harness.json().outcome).toBe('published');
  });

  it('separates an unreadable sheet from an unfinished one', async () => {
    const harness = setup();
    harness.ship.files.set(RUBRIC_PATH, '{ not json at all');
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-unreadable');
  });

  it('refuses a complete sheet that scores different bytes', async () => {
    // The binding that stops a revision-1 score being spent on revision 3.
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    sheet.bundleSha256 = '9'.repeat(64);
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-mismatch');
    expect(String(harness.json().message)).toContain(
      'Re-run `surface preview` on these bytes'
    );
  });

  it('refuses a complete sheet that scores a different app', async () => {
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    sheet.surfaceId = 'srf-somebody-elses-app';
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-mismatch');
    expect(String(harness.json().message)).toContain(
      'A rubric for one app says nothing about another'
    );
  });

  /**
   * The hole the bundle hash could not see, and the control for its closure.
   *
   * `bundleSha256` alone bound the sheet until this case was measured: a
   * revision that changes the SPEC and leaves the bundle alone keeps its hash,
   * so a sheet scored before the change still satisfied the binding and a
   * definition whose twelve cells were never rendered landed under a sheet
   * asserting they were. Both arms below come from the SAME `setup()` and the
   * SAME sheet; the only thing that moves between them is one string in the
   * spec file and whether preview was re-run.
   */
  it('refuses a sheet scored under a different SPEC, with the bundle unchanged', async () => {
    const harness = setup();
    const before = harness.deps.sha256Hex(
      harness.deps.readBinaryFile(BUNDLE_PATH)
    );

    // A spec-only revision: not one byte of the bundle moves.
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck, renamed' }))
    );
    expect(
      harness.deps.sha256Hex(harness.deps.readBinaryFile(BUNDLE_PATH))
    ).toBe(before);
    // And the sheet still names those unchanged bytes, so the older binding
    // was satisfied — this refusal can only come from the spec half.
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    expect(sheet.bundleSha256).toBe(before);

    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-mismatch');
    const message = String(result.message);
    expect(message).toContain('scores a spec hashing to');
    expect(message).toContain('SPEC-only change');
    expect(message).toContain('Re-run `surface preview` on this spec');
    // Named specifically, not as a generic failure: the two halves of the
    // identity have different repairs and must not read the same.
    expect(message).not.toContain('Those are different builds');
    expect((result.details as Record<string, unknown>).scoredSpec).toBe(
      sheet.specSha256
    );
    // Nothing reached the ship.
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  it('publishes that same spec once preview has been re-run on it', async () => {
    // The positive arm. Without it, the refusal above would pass equally
    // against a binding that refused every sheet ever written.
    const harness = setup();
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck, renamed' }))
    );
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-mismatch');

    restampRubric(harness);
    expect(await publish(harness)).toBe(0);
    expect(harness.json().outcome).toBe('published');
    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.title).toBe('Potluck, renamed');
  });

  it('publishes an unchanged spec against the sheet preview stamped for it', async () => {
    // The other positive control, and the cheapest one: touch nothing at all.
    // A binding that had been written over the wrong document — `specFile.rest`
    // rather than the verbatim parse, say — would refuse here.
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    expect(harness.json().outcome).toBe('published');
  });

  /**
   * The discriminator, and the reason it is an undeclared key.
   *
   * D138: a guard tested only against the fields its prediction named can pass
   * under the exact defect it was written to catch. `title` is declared on
   * `SurfaceSpecSchema`, so a spec hash taken over the VALIDATED view would
   * still have refused the two tests above — they cannot tell a raw hash from a
   * re-encoded one. Only a key the schema does not declare can, so the fixture
   * carries one and the first assertion pins that the fulcrum really is the
   * stripping.
   */
  it('refuses a change confined to a key the schema strips', async () => {
    const full = COMPLIANT_FIXTURE.spec as Record<string, unknown>;
    const marked = { ...full, 'x-fourth-bite': 'present' };
    // Raw, the two are different documents.
    expect(surfaceCanonicalHash(marked)).not.toBe(surfaceCanonicalHash(full));
    // Validated, they are the SAME document — so a hash over the validated
    // view is blind here, and this test is what notices if one is ever
    // introduced.
    expect(surfaceCanonicalHash(SurfaceSpecSchema.parse(marked))).toBe(
      surfaceCanonicalHash(SurfaceSpecSchema.parse(full))
    );

    const harness = setup();
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify({ ...specFile(), 'x-fourth-bite': 'present' })
    );
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('rubric-mismatch');
    expect(String(harness.json().message)).toContain('SPEC-only change');
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  /**
   * The hole one level below the spec binding, and the control for its closure.
   *
   * `surface preview --state <file>` renders a state the author supplies in
   * place of `initialState`. `RUBRIC.md` tells the scorer to do exactly that
   * for an app whose interesting screens no button reaches, and the countdown
   * template's NOTES say its `--state` run "is the only run that exercises
   * 'Passed' and 'in 12 hours'". Preview said so loudly on stdout and the
   * artifact carried nothing, so a sheet honestly filled in against a board the
   * app never opens on was indistinguishable from one filled in against its own
   * opening screen — and publish took it.
   *
   * Every arm below shares one `setup()`, one bundle and one spec. The only
   * thing that moves is which preview run the sheet came from.
   */
  it('refuses a sheet whose captures opened on a substituted state', async () => {
    const harness = setup();
    const spec = JSON.parse(harness.ship.files.get(SPEC_PATH) as string);
    // The board the countdown's `state.json` stands for: real, useful to look
    // at, and not what the app opens on.
    restampRubric(harness, { bringing: { '~zod': 'bread' }, closed: true });

    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    // Bundle and spec both still match, so neither of the older halves of the
    // binding can be what refuses below.
    expect(sheet.bundleSha256).toBe(
      harness.deps.sha256Hex(harness.deps.readBinaryFile(BUNDLE_PATH))
    );
    expect(sheet.specSha256).toBe(surfaceCanonicalHash(spec));
    expect(sheet.stateSource).toBe('override');

    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-mismatch');
    const message = String(result.message);
    expect(message).toContain('captures that opened on a state hashing to');
    expect(message).toContain('`--state` stood in');
    expect(message).toContain('a board this app never opens on');
    // Named as a STATE mismatch, not as either of the other two: three
    // different repairs must not read the same.
    expect(message).not.toContain('different builds');
    expect(message).not.toContain('SPEC-only change');
    const details = result.details as Record<string, unknown>;
    expect(details.scoredStateSource).toBe('override');
    expect(details.scoredState).toBe(sheet.stateSha256);
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  it('publishes the same app on a sheet from a run without --state', async () => {
    // The positive arm, and genuinely separate: this one never touches the
    // sheet `setup()` wrote. Without it the refusal above would pass equally
    // against a binding that refused every sheet in existence.
    const harness = setup();
    expect(
      JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string).stateSource
    ).toBe('spec-initial-state');
    expect(await publish(harness)).toBe(0);
    expect(harness.json().outcome).toBe('published');
  });

  it("accepts an override that IS the spec's own starting point", async () => {
    // The arm that pins WHAT is compared. A cheaper implementation — "refuse
    // any sheet whose stateSource is override" — passes the refusal above and
    // fails here, because these captures opened on exactly the board this app
    // opens on and are therefore the right captures.
    const harness = setup();
    const spec = JSON.parse(harness.ship.files.get(SPEC_PATH) as string);
    restampRubric(harness, spec.initialState);
    expect(
      JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string).stateSource
    ).toBe('override');
    expect(await publish(harness)).toBe(0);
    expect(harness.json().outcome).toBe('published');
  });

  it("refuses a sheet claiming the spec's own state while naming another", async () => {
    // The other direction of the same comparison, and the reason the hash is
    // stamped unconditionally rather than only for an override: a sheet that
    // SAYS it opened on the spec's starting point is still checked against it.
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    sheet.stateSha256 = 'b'.repeat(64);
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
    expect(await publish(harness)).toBe(1);
    const message = String(harness.json().message);
    expect(harness.json().code).toBe('rubric-mismatch');
    expect(message).toContain('scored on a spec that opened somewhere else');
    expect(message).not.toContain('`--state` stood in');
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  it('refuses a sheet that carries no state provenance', async () => {
    // Same compatibility stance as the spec hash, one level down: a sheet
    // written before the state binding existed carries neither field, and
    // accepting it would make the binding satisfiable by omission.
    for (const field of ['stateSource', 'stateSha256']) {
      const harness = setup();
      const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
      delete sheet[field];
      harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
      expect(await publish(harness)).toBe(1);
      expect(harness.json().code).toBe('rubric-incomplete');
      expect(String(harness.json().message)).toContain(`"${field}"`);
      expect(harness.ship.uploads).toHaveLength(0);
    }
  });

  it('refuses a sheet that carries no spec hash at all', async () => {
    // The compatibility decision, executable. Every sheet written before the
    // spec binding existed looks exactly like this, and so does any sheet
    // somebody deletes one line out of. Accepting it would make the binding
    // satisfiable by omission, which is the same as not having one.
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    delete sheet.specSha256;
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-incomplete');
    expect(String(result.message)).toContain('"specSha256"');
    expect(harness.ship.uploads).toHaveLength(0);
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  it('carries the residuals a shipped-with-known-defects publish declared', async () => {
    const harness = setup();
    const sheet = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    sheet.checks['tap-targets'] = {
      verdict: 'residual',
      cell: 'phone-populated-dark',
      note: 'the two vote buttons still touch on a 390px phone',
    };
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(sheet, null, 2));
    expect(await publish(harness)).toBe(0);
    const rubric = harness.json().rubric as Record<string, unknown>;
    expect(rubric.residuals).toEqual([
      {
        id: 'tap-targets',
        number: 2,
        verdict: 'residual',
        note: 'the two vote buttons still touch on a 390px phone',
      },
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* the generic-file fallback, removed                                  */
/* ------------------------------------------------------------------ */

/**
 * Session 6a, revision phase: after eighteen failed reads hunting for the
 * zine app, the bot reached for the generic `app.js`/`spec.json` lying in its
 * working directory — the potluck's leftovers, hash-confirmed — and aimed them
 * at the kanban channel. The `surfaceId` guard refused it, and that guard was
 * the only thing between "cannot find the current app" and a live board being
 * silently replaced with its state orphaned.
 *
 * **The fulcrum is whether publish could READ the channel's current
 * definition.** The `surfaceId` guard compares `current.surfaceId` against the
 * spec's, and `current` is null on BOTH "never published" and "published,
 * unreadable" — so on a channel whose definition had stopped validating, the
 * guard did not fire at all and the same mistake went all the way through. In
 * this test's world the only thing that moves the fulcrum is what the channel's
 * description cell holds, which is what these two arms differ in.
 *
 * The guard is unchanged. What is removed is the branch that let publish carry
 * on after failing to look up what it was about to overwrite.
 */
describe('surface publish — a failed lookup is a failed operation', () => {
  /** The kanban board, live, with a definition nobody can read any more. */
  function kanbanWithUnreadableDefinition() {
    const harness = setup({
      spec: specFile({ surfaceId: 'srf-potluck-leftovers' }),
    });
    harness.ship.setChannelSpec(CHANNEL, {
      version: 1,
      surfaceId: 'srf-kanban-zine',
      // no `bundle`, no `initialState`, no `actions`: the shape a half-written
      // definition leaves, and exactly what `readChannelSpec` reports as
      // "invalid" rather than "absent"
      specRevision: 4,
    });
    harness.ship.addPost(CHANNEL, {
      authorId: '~ten',
      blob: JSON.stringify([
        {
          type: 'surface-event',
          version: 1,
          surfaceId: 'srf-kanban-zine',
          specRevision: 4,
          mode: 'invoke',
          actionId: 'claim-layout',
        },
      ]),
    });
    return harness;
  }

  it('refuses to publish over a definition it cannot read', async () => {
    const harness = kanbanWithUnreadableDefinition();
    const before = harness.ship.channelSpecText(CHANNEL);

    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('current-definition-unreadable');
    expect(String(result.message)).toContain('tlon surface show');

    // Nothing moved: not the cell, not storage, not the channel's posts.
    expect(harness.ship.channelSpecText(CHANNEL)).toBe(before);
    expect(harness.ship.uploads).toHaveLength(0);
    expect(blobEntries(harness)).toHaveLength(1);
  });

  it('is the refusal that 6a’s surfaceId guard could not make', async () => {
    // The pre-fix behaviour, stated as an assertion about the guard rather
    // than a claim about history: with the definition unreadable there is no
    // `current.surfaceId` to compare, so a potluck spec and a kanban channel
    // are indistinguishable to the guard. The refusal above cannot be coming
    // from it.
    const harness = kanbanWithUnreadableDefinition();
    await publish(harness);
    expect(harness.json().code).not.toBe('surface-id-changed');

    const readable = setup({
      spec: specFile({ surfaceId: 'srf-potluck-leftovers' }),
    });
    readable.ship.setChannelSpec(CHANNEL, {
      version: 1,
      surfaceId: 'srf-kanban-zine',
      specRevision: 4,
      bundle: {
        assetRef: 'https://storage.example/kanban.js',
        sha256: 'c'.repeat(64),
        size: 10,
        shellVersion: 1,
      },
      initialState: {},
      actions: {},
    });
    expect(await publish(readable)).toBe(1);
    expect(readable.json().code).toBe('surface-id-changed');
  });

  it('still publishes to a channel that has never held a definition', async () => {
    // "Absent" and "unreadable" are different situations and only one of them
    // is a failed lookup. A refusal that could not tell them apart would break
    // every first publish, which is the obvious over-correction here.
    const harness = setup();
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
    expect(await publish(harness)).toBe(0);
    expect(harness.json().specRevision).toBe(1);
  });

  it('lets an explicit acknowledgment through, and names what it destroys', async () => {
    const harness = kanbanWithUnreadableDefinition();
    expect(await publish(harness, ['--allow-unreadable-definition'])).toBe(0);
    expect(harness.json().specRevision).toBe(1);
    expect(harness.err()).toContain(
      'Replacing chat/~zod/dash-0001\'s unreadable definition with surface "srf-potluck-leftovers"'
    );
    expect(harness.err()).toContain(
      'every existing event and snapshot is orphaned'
    );
  });
});

/**
 * The wrong-board write, reproduced and then fenced.
 *
 * The verdict run asserted a revision against one board and published it to a
 * different, similarly-named one. Every check in the pipeline passed, because
 * every check asked whether the definition landed and none asked whether it
 * landed HERE. These are the two shapes that failure can take — the wrong
 * channel, and the right channel at the wrong moment — and both of them are
 * run first WITHOUT the fence, so what the fence changes is visible rather
 * than asserted.
 */
describe('surface publish — the write fence', () => {
  const DECOY = 'chat/~zod/dash-0002';
  const OTHER_GROUP = '~zod/surface-seed';

  /** The identity `surface publish` will compute for CHANNEL as it stands. */
  function identityOf(
    harness: ReturnType<typeof setup>,
    channelId: string
  ): string {
    const raw = harness.ship.channelSpecText(channelId);
    if (raw === null) return 'unpublished:empty';
    return `spec:${harness.deps.sha256Hex(new TextEncoder().encode(raw))}`;
  }

  async function publishTo(
    harness: ReturnType<typeof setup>,
    channelId: string
  ) {
    return run(
      [
        'publish',
        channelId,
        '--bundle',
        BUNDLE_PATH,
        '--spec',
        SPEC_PATH,
        '--rubric',
        RUBRIC_PATH,
        '--json',
      ],
      harness.deps
    );
  }

  it('lands on a same-group sibling when nothing is bound — the failure itself', async () => {
    const harness = setup();
    harness.ship.addChannel(GROUP, DECOY);
    expect(await publishTo(harness, DECOY)).toBe(0);
    expect(harness.json().ok).toBe(true);
    // Reported as a clean publish, because it was one. Just not this one.
    expect(harness.ship.channelSpecText(DECOY)).not.toBeNull();
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
  });

  it('refuses the sibling once a channel is bound, and names both', async () => {
    const harness = setup({
      writeScope: {
        source: '/fence.json',
        channel: CHANNEL,
        preState: null,
        groups: null,
      },
    });
    harness.ship.addChannel(GROUP, DECOY);
    expect(await publishTo(harness, DECOY)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('write-out-of-scope');
    expect(result.message).toContain(DECOY);
    expect(result.message).toContain(CHANNEL);
    // And nothing was written anywhere: the refusal is before the write, not
    // a report about one.
    expect(harness.ship.channelSpecText(DECOY)).toBeNull();
    expect(harness.ship.descriptionWrites).toHaveLength(0);
  });

  it('refuses a board in an unscoped group, which is what actually happened', async () => {
    const harness = setup({
      writeScope: {
        source: '/fence.json',
        channel: null,
        preState: null,
        groups: [GROUP],
      },
    });
    harness.ship.addGroup(OTHER_GROUP);
    harness.ship.addChannel(OTHER_GROUP, DECOY);
    expect(await publishTo(harness, DECOY)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('write-out-of-scope');
    expect(result.message).toContain(OTHER_GROUP);
    expect(harness.ship.channelSpecText(DECOY)).toBeNull();
  });

  it('still publishes to the bound channel — the fence is not a stop-work order', async () => {
    const harness = setup();
    const bound = setup({
      writeScope: {
        source: '/fence.json',
        channel: CHANNEL,
        preState: identityOf(harness, CHANNEL),
        groups: [GROUP],
      },
    });
    expect(await publishTo(bound, CHANNEL)).toBe(0);
    expect(bound.json().specRevision).toBe(1);
  });

  it('refuses when the pre-state moved between the bound and the publish', async () => {
    const harness = setup();
    // Revision 1 lands, unfenced.
    expect(await publish(harness)).toBe(0);
    const bound = identityOf(harness, CHANNEL);

    // Something else revises the board — here, a second publish of different
    // bytes, which is exactly what a concurrent turn would do.
    harness.ship.files.set(
      BUNDLE_PATH,
      `${COMPLIANT_FIXTURE.bundleSource}\n// a later revision\n`
    );
    restampRubric(harness);
    expect(await publish(harness)).toBe(0);
    expect(harness.json().specRevision).toBe(2);
    expect(identityOf(harness, CHANNEL)).not.toBe(bound);

    // Now a publish bound to the definition as it stood BEFORE that.
    harness.deps.writeScope = {
      source: '/fence.json',
      channel: CHANNEL,
      preState: bound,
      groups: [GROUP],
    };
    harness.ship.files.set(
      BUNDLE_PATH,
      `${COMPLIANT_FIXTURE.bundleSource}\n// the bound turn's edit\n`
    );
    restampRubric(harness);
    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('pre-state-moved');
    expect(result.message).toContain(bound);
    expect(result.message).toContain(identityOf(harness, CHANNEL));
    // Revision 2 is untouched: the definition nobody asserted anything about
    // is still the one on the channel.
    expect(harness.ship.descriptionWrites).toHaveLength(2);
  });

  it('binds an unpublished channel by its post head', async () => {
    const harness = setup({
      writeScope: {
        source: '/fence.json',
        channel: CHANNEL,
        preState: 'unpublished:empty',
        groups: [GROUP],
      },
    });
    expect(harness.ship.channelSpecText(CHANNEL)).toBeNull();
    expect(await publish(harness)).toBe(0);
    expect(harness.json().specRevision).toBe(1);
  });

  it('refuses an unpublished channel that has been posted to since the bound', async () => {
    const harness = setup({
      writeScope: {
        source: '/fence.json',
        channel: CHANNEL,
        preState: 'unpublished:seq:99',
        groups: [GROUP],
      },
    });
    expect(await publish(harness)).toBe(1);
    expect(harness.json().code).toBe('pre-state-moved');
  });
});

/**
 * The control for the escape hatch that produced the defect it prevented.
 *
 * Rule 15 was added because two "who owes what" apps shipped with `actions: {}`
 * — expense splits nobody can add an expense to. The next expense app shipped
 * inert AGAIN, one session later, declared this time, so the rule never fired:
 * the marker had been copied out of the doctrine's snippet before any lint ran.
 *
 * The marker now costs a sentence, and the sentence costs a scored check. This
 * is that check being unskippable: a spec that claims to be display-only draws
 * a rubric requirement a sheet written for an ordinary app does not satisfy.
 */
describe('surface publish — a display-only claim is scored', () => {
  // The app that shipped inert twice, byte for byte: a bundle with no invokes
  // and a spec with no actions. The compliant fixture cannot stand in — its
  // bundle invokes the actions it declares, so emptying the action map trips
  // the gate on undeclared invokes and the refusal under test would never be
  // the one measured.
  function displayOnly(marker: unknown) {
    const spec: Record<string, unknown> = { ...BEACH_TRIP_SPLIT_SPEC };
    delete spec.bundle;
    delete spec.specRevision;
    if (marker !== undefined) spec.memberInteraction = marker;
    return spec;
  }

  function displayOnlySetup(marker: unknown) {
    return setup({
      bundle: BEACH_TRIP_SPLIT_BUNDLE,
      spec: displayOnly(marker),
    });
  }

  it('refuses a display-only app whose sheet never scored the claim', async () => {
    const harness = displayOnlySetup({
      mode: 'none',
      because: 'the organizer republishes it when things change',
    });
    // A complete sheet — for an ordinary app. Every one of the seven universal
    // checks is filled in, which is exactly the sheet the inert expense app
    // shipped with.
    expect(await publish(harness)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('rubric-incomplete');
    expect(result.message).toContain('display-only-was-asked-for');
  });

  it('publishes once the claim is scored', async () => {
    const harness = displayOnlySetup({
      mode: 'none',
      because: 'the launch date is fixed at creation',
    });
    const rubric = JSON.parse(harness.ship.files.get(RUBRIC_PATH) as string);
    rubric.checks['display-only-was-asked-for'] = {
      verdict: 'pass',
      cell: RUBRIC_CELL_IDS[0],
      note: 'the request was "a countdown to launch day"; nothing about it wants a button, and the date is written once at creation',
    };
    harness.ship.files.set(RUBRIC_PATH, JSON.stringify(rubric));
    expect(await publish(harness)).toBe(0);
    expect(harness.json().specRevision).toBe(1);
    // And the marker round-trips in its new shape, `because` and all: the
    // sentence is only worth asking for if it survives to the channel, where
    // the next revise cycle re-lints against it.
    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.memberInteraction).toEqual({
      mode: 'none',
      because: 'the launch date is fixed at creation',
    });
  });

  it('asks nothing extra of an app that makes no such claim', async () => {
    // The other arm: without this, "refuses" above would pass equally against
    // a validator that had started demanding check 8 of every sheet.
    const harness = displayOnlySetup(undefined);
    expect(await publish(harness)).toBe(0);
  });
});
