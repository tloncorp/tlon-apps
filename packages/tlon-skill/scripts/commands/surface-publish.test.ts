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
    expect(decideRevision(current, candidate)).toEqual({
      changed: true,
      revision: 5,
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

  it('refuses when the definition it would migrate from is itself pending', async () => {
    const harness = withHistory();
    await publish(harness, ['--preserve-state']);
    // The revision-1 snapshot exists; retract it by hand so the surface is
    // migration-pending, then try to migrate off it.
    const posts = harness.ship.posts.get(CHANNEL) ?? [];
    const snapshotPost = posts.find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    if (snapshotPost) snapshotPost.isEdited = true;

    harness.ship.files.set(
      SPEC_PATH,
      JSON.stringify(specFile({ title: 'Potluck v3' }))
    );
    expect(await publish(harness, ['--preserve-state'])).toBe(1);
    expect(harness.json().code).toBe('migration-pending');
  });
});
