import { describe, expect, it } from 'bun:test';

import { COMPLIANT_FIXTURE, RULE_FIXTURES } from '../surface-lint-fixtures';
import {
  type FakeShipOptions,
  createTestSurfaceDeps,
} from '../surface-test-doubles';
import { run } from './surface';
import { decideRevision, specContentKey } from './surface-publish';

const GROUP = '~zod/dashboards';
const CHANNEL = 'chat/~zod/dash-0001';
const BUNDLE_PATH = '/work/app.js';
const SPEC_PATH = '/work/spec.json';

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
  harness.ship.files.set(
    SPEC_PATH,
    JSON.stringify(options.spec ?? specFile(), null, 2)
  );
  return harness;
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

    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck, renamed' }))
    );
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

    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ specRevision: 47, title: 'Renamed' }))
    );
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

    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ surfaceId: 'srf-something-else' }))
    );
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
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck v2' }))
    );

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

  it('carries a gate-only marker through to the stored definition', async () => {
    // `duplicatesTolerated` is NOT in SurfaceActionSchema — z.object strips
    // unknown keys (D67). It survives only because publish writes the raw
    // assembled object and uses the schema check purely as a check. If that
    // ever becomes `write(schemaCheck.value)`, the marker vanishes from the
    // published definition, and the next revise cycle re-lints a spec whose
    // append action has lost its opt-out and fails with no recourse. This
    // pins the write, not the validation.
    const harness = withHistory();
    const marked = specFile();
    const firstAction = Object.keys(
      (marked as { actions: Record<string, unknown> }).actions
    )[0];
    (marked as { actions: Record<string, Record<string, unknown>> }).actions[
      firstAction
    ].duplicatesTolerated = true;
    harness.ship.files.set(SPEC_PATH, JSON.stringify(marked));

    expect(await publish(harness)).toBe(0);

    const stored = JSON.parse(harness.ship.channelSpecText(CHANNEL) ?? '{}');
    expect(stored.actions[firstAction].duplicatesTolerated).toBe(true);
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
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck, renamed' }))
    );
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

    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck, renamed' }))
    );
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

    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck v2' }))
    );
    expect(await publish(harness, ['--preserve-state'])).toBe(0);

    // The revision-2 snapshot exists; retract it by hand so the surface is
    // migration-pending, then try to migrate off it.
    const snapshotPost = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    expect(snapshotPost).toBeDefined();
    snapshotPost!.isEdited = true;

    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck v3' }))
    );
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

  /** Revision 2 published and mirrored; its migration snapshot never landed. */
  async function stranded(ops?: unknown[]) {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    withEvent(harness, ops);
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck v2' }))
    );

    // The poke for the snapshot resolves and nothing lands — the D50 shape,
    // and the same thing a crash between the two writes leaves behind.
    const send = harness.deps.sendSurfacePost;
    harness.deps.sendSurfacePost = async (input) => {
      if (input.kindTail === 'surface/snapshot') return;
      return send(input);
    };
    expect(await publish(harness, ['--preserve-state'])).toBe(1);
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
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck v2' }))
    );
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

  it('refuses to finalize an aborted entry, and names the command that can', async () => {
    // The state being carried across would be the partial prefix of an entry
    // that stopped early, so this repair would freeze the prefix and put the
    // failed entry under the boundary. Publish has no flag to accept that
    // with, so it refuses and names the command that does rather than deciding
    // on the host's behalf.
    const harness = await stranded([
      { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
      { op: 'set', path: '/bringing/~0ten', value: 'pie' },
    ]);

    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('usage');
    expect(String(result.message)).toContain(
      `tlon surface snapshot ${CHANNEL} --allow-aborted-events`
    );
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(0);
  });

  it('still reports a no-op when a short read already proves the channel healthy', async () => {
    const harness = setup();
    expect(await publish(harness)).toBe(0);
    withEvent(harness);
    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck v2' }))
    );
    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    // A snapshot at the current revision is conclusive wherever it is found,
    // so a history that cannot be paged to its start is no reason to refuse a
    // republish of a channel that is demonstrably fine.
    truncateHistory(harness);

    expect(await publish(harness, ['--preserve-state'])).toBe(0);
    expect(harness.json().outcome).toBe('no-op');
  });
});
