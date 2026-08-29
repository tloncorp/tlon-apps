import { describe, expect, it } from 'bun:test';

import {
  type FakeShipOptions,
  createTestSurfaceDeps,
} from '../surface-test-doubles';
import { run } from './surface';
import { usesActorPlaceholder } from './surface-records';

const GROUP = '~zod/dashboards';
const CHANNEL = 'chat/~zod/dash-0001';
const SURFACE_ID = 'srf-potluck';

function spec(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    surfaceId: SURFACE_ID,
    specRevision: 1,
    title: 'Potluck',
    bundle: {
      assetRef: 'https://storage.example/app.js',
      sha256: 'a'.repeat(64),
      size: 1024,
      shellVersion: 1,
    },
    initialState: { bringing: { '~zod': 'bread' } },
    actions: {
      'bring-salad': {
        ops: [{ op: 'set', path: '/bringing/$actor', value: 'salad' }],
      },
    },
    ...overrides,
  };
}

function setup(
  options: FakeShipOptions & { spec?: Record<string, unknown> | null } = {}
) {
  const harness = createTestSurfaceDeps(options);
  harness.ship.addGroup(GROUP);
  harness.ship.addChannel(GROUP, CHANNEL);
  if (options.spec !== null) {
    harness.ship.setChannelSpec(CHANNEL, options.spec ?? spec());
  }
  return harness;
}

function addEvent(
  harness: ReturnType<typeof setup>,
  entry: Record<string, unknown>,
  post: { authorId?: string; isEdited?: boolean } = {}
) {
  return harness.ship.addPost(CHANNEL, {
    authorId: post.authorId ?? '~zod',
    isEdited: post.isEdited ?? false,
    blob: JSON.stringify([entry]),
    kind: '/chat/surface/event',
  });
}

function hostEvent(ops: unknown[], specRevision = 1) {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: SURFACE_ID,
    specRevision,
    mode: 'host',
    ops,
  };
}

describe('usesActorPlaceholder', () => {
  it('finds the exact placeholder anywhere in a value tree', () => {
    expect(usesActorPlaceholder('$actor')).toBe(true);
    expect(usesActorPlaceholder({ a: [{ b: '$actor' }] })).toBe(true);
    expect(usesActorPlaceholder('the $actor thing')).toBe(false);
    expect(usesActorPlaceholder({ a: 1 })).toBe(false);
  });
});

describe('surface event', () => {
  it('posts one host-mode entry per post and observes it', async () => {
    const harness = setup();
    const code = await run(
      ['event', CHANNEL, '--set', '/bringing/~0ten', '"pie"', '--json'],
      harness.deps
    );

    expect(code).toBe(0);
    const result = harness.json();
    expect(result.outcome).toBe('posted');
    expect(result.kind).toBe('/chat/surface/event');
    expect(result.specRevision).toBe(1);

    const posts = harness.ship.posts.get(CHANNEL) ?? [];
    expect(posts).toHaveLength(1);
    const entries = JSON.parse(posts[0].blob ?? '[]');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      type: 'surface-event',
      version: 1,
      surfaceId: SURFACE_ID,
      specRevision: 1,
      mode: 'host',
      ops: [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }],
    });
  });

  it('keeps ops in the order they were written', async () => {
    const harness = setup();
    await run(
      [
        'event',
        CHANNEL,
        '--set',
        '/a',
        '1',
        '--del',
        '/b',
        '--append',
        '/c',
        '2',
        '--json',
      ],
      harness.deps
    );
    const entries = JSON.parse(
      (harness.ship.posts.get(CHANNEL) ?? [])[0].blob ?? '[]'
    );
    expect(entries[0].ops.map((op: { op: string }) => op.op)).toEqual([
      'set',
      'del',
      'append',
    ]);
  });

  it('refuses a host op the reducer would silently skip', async () => {
    const harness = setup();
    expect(
      await run(
        ['event', CHANNEL, '--set', '/bringing/$actor', '"pie"', '--json'],
        harness.deps
      )
    ).toBe(1);
    expect(harness.json().code).toBe('invalid-ops');
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);

    const value = setup();
    expect(
      await run(
        ['event', CHANNEL, '--set', '/who', '"$actor"', '--json'],
        value.deps
      )
    ).toBe(1);
    expect(value.json().code).toBe('invalid-ops');
  });

  it('refuses a path the shared pointer grammar rejects', async () => {
    const harness = setup();
    expect(
      await run(
        ['event', CHANNEL, '--set', 'bringing/ten', '"pie"', '--json'],
        harness.deps
      )
    ).toBe(1);
    expect(harness.json().code).toBe('invalid-ops');
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);
  });

  it('refuses more ops than an event may carry', async () => {
    const harness = setup();
    const ops = Array.from({ length: 21 }, (_, index) => ({
      op: 'set',
      path: `/k${index}`,
      value: index,
    }));
    expect(
      await run(
        ['event', CHANNEL, '--ops', JSON.stringify(ops), '--json'],
        harness.deps
      )
    ).toBe(1);
    expect(harness.json().code).toBe('invalid-ops');
  });

  it('refuses when the channel carries no definition', async () => {
    const harness = setup({ spec: null });
    expect(
      await run(['event', CHANNEL, '--del', '/a', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('spec-absent');
  });

  it('refuses when the definition does not validate', async () => {
    const harness = setup({ spec: { version: 1, surfaceId: 'x' } });
    expect(
      await run(['event', CHANNEL, '--del', '/a', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('spec-invalid');
  });

  it('refuses a channel %channels does not hold', async () => {
    const harness = createTestSurfaceDeps({});
    harness.ship.addGroup(GROUP);
    expect(
      await run(['event', CHANNEL, '--del', '/a', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('channel-not-found');
  });

  it('names the half-created channel for what it is', async () => {
    const harness = createTestSurfaceDeps({});
    harness.ship.addGroup(GROUP);
    harness.ship.burnName(CHANNEL);
    expect(
      await run(['event', CHANNEL, '--del', '/a', '--json'], harness.deps)
    ).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('channel-not-found');
    expect(String(result.message)).toContain('half-created');
  });
});

describe('surface event — retraction', () => {
  it('retracts by editing, and keeps the surface kind', async () => {
    const harness = setup();
    const post = addEvent(harness, hostEvent([{ op: 'del', path: '/x' }]));

    expect(
      await run(
        ['event', CHANNEL, '--retract', post.id, '--json'],
        harness.deps
      )
    ).toBe(0);
    const result = harness.json();
    expect(result.outcome).toBe('retracted');
    expect(result.kind).toBe('/chat/surface/event');
    expect(post.isEdited).toBe(true);
  });

  /**
   * The `%edit` arm replaces the essay wholesale without re-checking kind, so
   * a retraction that lost the tail would rewrite the record to `/chat` and
   * report success. The command must read the kind back and refuse.
   */
  it('fails when the edit drops the kind tail', async () => {
    const harness = setup({ editDropsKindTail: true });
    const post = addEvent(harness, hostEvent([{ op: 'del', path: '/x' }]));

    expect(
      await run(
        ['event', CHANNEL, '--retract', post.id, '--json'],
        harness.deps
      )
    ).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('kind-tail-lost');
    expect((result.details as Record<string, unknown>).expected).toBe(
      '/chat/surface/event'
    );
    expect((result.details as Record<string, unknown>).observed).toBe('/chat');
  });

  it('refuses to retract a post that is not there', async () => {
    const harness = setup();
    expect(
      await run(
        ['event', CHANNEL, '--retract', 'post-999', '--json'],
        harness.deps
      )
    ).toBe(1);
    expect(harness.json().code).toBe('post-not-found');
  });
});

describe('surface state — through the shared reducer', () => {
  it('folds host events onto the definition initial state', async () => {
    const harness = setup();
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }])
    );

    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.status).toBe('reduced');
    expect(result.state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });
    expect(result.foldedEventCount).toBe(1);
  });

  it('ignores host ops from anyone but the channel host', async () => {
    const harness = setup();
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }]),
      { authorId: '~ten' }
    );

    await run(['state', CHANNEL, '--json'], harness.deps);
    expect(harness.json().state).toEqual({ bringing: { '~zod': 'bread' } });
  });

  it('treats an edited event as a retraction', async () => {
    const harness = setup();
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }]),
      { isEdited: true }
    );

    await run(['state', CHANNEL, '--json'], harness.deps);
    expect(harness.json().state).toEqual({ bringing: { '~zod': 'bread' } });
  });

  it('drops a host event tagged with a stale revision', async () => {
    const harness = setup({ spec: spec({ specRevision: 3 }) });
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }], 1)
    );

    await run(['state', CHANNEL, '--json'], harness.deps);
    expect(harness.json().state).toEqual({ bringing: { '~zod': 'bread' } });
    expect(harness.json().skippedEventCount).toBe(1);
  });

  it('reports migration-pending rather than a fold', async () => {
    const harness = setup({ spec: spec({ preserveState: true }) });
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.status).toBe('migration-pending');
    expect(result.state).toBe(null);
  });

  it('refuses to present a partial fold', async () => {
    const harness = setup({ pageSize: 1 });
    for (let index = 0; index < 5; index += 1) {
      addEvent(
        harness,
        hostEvent([{ op: 'set', path: `/k${index}`, value: 1 }])
      );
    }
    expect(
      await run(['state', CHANNEL, '--max-posts', '2', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('partial-hydration');
  });
});

describe('surface snapshot', () => {
  it('posts the current fold at the current revision and observes it', async () => {
    const harness = setup();
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }])
    );

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.kind).toBe('/chat/surface/snapshot');
    expect(result.specRevision).toBe(1);
    expect(result.upToSequenceNum).toBe(1);

    const snapshotPost = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    const entries = JSON.parse(snapshotPost?.blob ?? '[]');
    expect(entries).toHaveLength(1);
    expect(entries[0].state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });
  });

  it('refuses a boundary beyond the channel history', async () => {
    const harness = setup();
    expect(
      await run(['snapshot', CHANNEL, '--up-to', '99', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('usage');
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);
  });

  it('folds from a valid snapshot at the current revision', async () => {
    const harness = setup();
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }])
    );
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      kind: '/chat/surface/snapshot',
      blob: JSON.stringify([
        {
          type: 'surface-snapshot',
          version: 1,
          surfaceId: SURFACE_ID,
          specRevision: 1,
          upToSequenceNum: 1,
          state: { bringing: { frozen: true } },
        },
      ]),
    });

    await run(['state', CHANNEL, '--json'], harness.deps);
    const result = harness.json();
    expect(result.state).toEqual({ bringing: { frozen: true } });
    expect(result.baseSnapshotSeq).toBe(1);
  });
});

/**
 * `surface snapshot` at a pending revision is the REPAIR, so it has to be
 * permitted — the refusal that used to stand here forbade the only exit a
 * stranded channel has. It still may not invent state, which is what the
 * refusal was really protecting, so every case below is either a
 * reconstruction from the definition the state was last live under or an
 * honest refusal.
 */
describe('surface snapshot — repairing a pending migration', () => {
  /** The mirror publish writes after every revision: the revision history. */
  function addMirror(
    harness: ReturnType<typeof setup>,
    mirrored: Record<string, unknown>,
    post: { authorId?: string } = {}
  ) {
    return harness.ship.addPost(CHANNEL, {
      authorId: post.authorId ?? '~zod',
      kind: '/chat/surface/spec',
      blob: JSON.stringify([
        {
          type: 'surface-spec-mirror',
          version: 1,
          surfaceId: SURFACE_ID,
          specRevision: mirrored.specRevision,
          spec: mirrored,
        },
      ]),
    });
  }

  /**
   * A channel stranded exactly the way the finding describes: revision 1 ran
   * normally and collected state, revision 2 landed as a preserving revision
   * with its mirror, and the migration snapshot never got posted.
   */
  function stranded() {
    const harness = setup();
    addMirror(harness, spec());
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }])
    );
    const revised = spec({
      specRevision: 2,
      title: 'Potluck, renamed',
      preserveState: true,
    });
    addMirror(harness, revised);
    harness.ship.setChannelSpec(CHANNEL, revised);
    return harness;
  }

  it('repairs a stranded channel without discarding its state', async () => {
    const harness = stranded();

    // The premise: the channel really is stuck.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().status).toBe('migration-pending');

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.repairedMigration).toBe(true);
    expect(result.specRevision).toBe(2);
    expect(result.carriedFromRevision).toBe(1);
    expect(result.kind).toBe('/chat/surface/snapshot');

    // The state that was live under revision 1 is what got carried across.
    const posted = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    expect(JSON.parse(posted?.blob ?? '[]')[0].state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });

    // And the channel is live again at the new revision.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const after = harness.json();
    expect(after.status).toBe('reduced');
    expect(after.specRevision).toBe(2);
    expect(after.state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });
  });

  /**
   * The boundary is the state's own coverage, not the newest post. A repair
   * that claimed everything up to now would freeze out events already written
   * at the current revision — silently, and permanently.
   */
  it('leaves current-revision events above the boundary it claims', async () => {
    const harness = stranded();
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0bus', value: 'wine' }], 2)
    );

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().upToSequenceNum).toBe(2);

    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie', '~bus': 'wine' },
    });
  });

  it('carries the starting state when the revision never held any', async () => {
    const harness = setup({ spec: spec({ preserveState: true }) });
    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.repairedMigration).toBe(true);
    expect(result.carriedFromRevision).toBe(null);
    expect(result.upToSequenceNum).toBe(0);

    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().state).toEqual({ bringing: { '~zod': 'bread' } });
  });

  it('refuses rather than guess when the previous definition is missing', async () => {
    const harness = setup();
    // Events from revision 1 exist, but nothing records what revision 1 WAS,
    // so the state they folded to cannot be reconstructed.
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }])
    );
    harness.ship.setChannelSpec(
      CHANNEL,
      spec({ specRevision: 2, preserveState: true })
    );

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    expect(harness.json().code).toBe('migration-pending');
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(0);
  });

  it('ignores a mirror that did not come from the host', async () => {
    const harness = stranded();
    // A member's mirror claiming a different revision-1 definition must not
    // steer the fold that decides what the surface's state becomes.
    addMirror(
      harness,
      spec({ initialState: { bringing: { '~ten': 'everything' } } }),
      { authorId: '~ten' }
    );

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(0);
    const posted = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    expect(JSON.parse(posted?.blob ?? '[]')[0].state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });
  });

  it('refuses when the previous revision is itself pending', async () => {
    const harness = setup();
    addMirror(harness, spec({ preserveState: true }));
    const revised = spec({ specRevision: 2, preserveState: true });
    addMirror(harness, revised);
    harness.ship.setChannelSpec(CHANNEL, revised);

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('migration-pending');
    expect((result.details as Record<string, unknown>).previousRevision).toBe(
      1
    );
  });

  it('refuses a repair from anyone but the channel host', async () => {
    const harness = createTestSurfaceDeps({ ship: '~ten' });
    harness.ship.addGroup(GROUP);
    harness.ship.addChannel(GROUP, CHANNEL);
    harness.ship.setChannelSpec(CHANNEL, spec({ preserveState: true }));

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('migration-pending');
    expect(String(result.message)).toContain('only its host ~zod');
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);
  });

  it('refuses a hand-supplied boundary on the repair path', async () => {
    const harness = stranded();
    expect(
      await run(['snapshot', CHANNEL, '--up-to', '1', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('usage');
  });
});
