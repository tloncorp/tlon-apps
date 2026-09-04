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
 * A snapshot record is a pair: a state, and the boundary that state claims to
 * cover. The two have to be folded from the SAME events, because the reducer
 * trusts the pair and never checks it — it starts from the state and replays
 * everything strictly above the boundary. Compute them from different
 * populations and the record is permanently wrong in one of two directions:
 * a state folded PAST the boundary keeps the events above it and leaves them
 * replayable, so every client double-counts them on every fold, forever; a
 * state folded SHORT of the boundary loses the events below it, because the
 * reducer never looks below a boundary again.
 *
 * The appends below are what make either direction visible: a `set` is
 * idempotent under replay, so it would hide both.
 */
describe('surface snapshot — the state and the boundary it claims', () => {
  function logHarness() {
    return setup({ spec: spec({ initialState: { log: [] } }) });
  }

  function append(harness: ReturnType<typeof setup>, value: string) {
    return addEvent(
      harness,
      hostEvent([{ op: 'append', path: '/log', value }])
    );
  }

  it('folds only what the boundary covers, so replay does not repeat it', async () => {
    const harness = logHarness();
    append(harness, 'a'); // sequence 1
    append(harness, 'b'); // sequence 2

    expect(
      await run(['snapshot', CHANNEL, '--up-to', '1', '--json'], harness.deps)
    ).toBe(0);
    expect(harness.json().upToSequenceNum).toBe(1);

    const posted = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    // A boundary of 1 covers the fold of sequence 1 and nothing else.
    expect(JSON.parse(posted?.blob ?? '[]')[0].state).toEqual({ log: ['a'] });

    // And the fold every client runs replays sequence 2 exactly once.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().state).toEqual({ log: ['a', 'b'] });
  });

  it('keeps the event at the boundary itself inside the state', async () => {
    const harness = logHarness();
    append(harness, 'a'); // sequence 1
    append(harness, 'b'); // sequence 2
    append(harness, 'c'); // sequence 3

    expect(
      await run(['snapshot', CHANNEL, '--up-to', '2', '--json'], harness.deps)
    ).toBe(0);
    const posted = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    expect(JSON.parse(posted?.blob ?? '[]')[0].state).toEqual({
      log: ['a', 'b'],
    });

    // The boundary is inclusive: sequence 2 is IN the state and never
    // replayed, sequence 3 is outside it and replayed once. A fold that
    // stopped short of the boundary would lose 'b' for good.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().state).toEqual({ log: ['a', 'b', 'c'] });
  });

  it('refuses a boundary below the snapshot the revision folds from', async () => {
    const harness = setup({
      spec: spec({ initialState: { log: [] }, preserveState: true }),
    });
    append(harness, 'a'); // sequence 1
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
          state: { log: ['a'] },
        },
      ]),
    }); // sequence 2
    append(harness, 'b'); // sequence 3

    // Below sequence 2 the migration snapshot is not yet in the channel, so
    // this preserving revision has no state at that boundary at all. There is
    // nothing honest to write, and inventing one is what the migration gate
    // exists to prevent.
    expect(
      await run(['snapshot', CHANNEL, '--up-to', '1', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('usage');
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(1);
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

  /**
   * The repair reconstructs the previous revision's fold, so it inherits that
   * fold's aborted entries — and freezing a prefix is exactly as destructive
   * here as on the ordinary path. The channel really is stranded, so the
   * refusal has to leave a way through, and it is the same named flag.
   */
  it('refuses to repair over an aborted fold, and takes the same flag', async () => {
    const harness = setup();
    addMirror(harness, spec());
    addEvent(
      harness,
      hostEvent([
        { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
        { op: 'set', path: '/bringing/~0ten', value: 'pie' },
      ])
    );
    const revised = spec({ specRevision: 2, preserveState: true });
    addMirror(harness, revised);
    harness.ship.setChannelSpec(CHANNEL, revised);

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const refused = harness.json();
    expect(refused.code).toBe('usage');
    expect(String(refused.message)).toContain('--allow-aborted-events');
    expect(
      (harness.ship.posts.get(CHANNEL) ?? []).filter(
        (post) => post.kind === '/chat/surface/snapshot'
      )
    ).toHaveLength(0);

    expect(
      await run(
        ['snapshot', CHANNEL, '--allow-aborted-events', '--json'],
        harness.deps
      )
    ).toBe(0);
    const allowed = harness.json();
    expect(allowed.repairedMigration).toBe(true);
    expect(allowed.abortedSequenceNums).toEqual([2]);
  });

  /**
   * The same refusal on the repair branch, with more than one abort, so what
   * the flag waives is enumerated rather than counted — and at sequences that
   * are neither adjacent nor at the ends of the history, so an enumeration
   * that is off by one, that reports every folded entry, or that reports the
   * first abort only, all read differently from `[11, 17]`.
   */
  it('names every aborted sequence the flag waives through, on the repair branch', async () => {
    const harness = setup();
    addMirror(harness, spec());
    const abortingOps = (dish: string) => [
      { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
      { op: 'set', path: '/bringing/~0bus', value: dish },
    ];
    const at = (sequenceNum: number, ops: unknown[]) =>
      harness.ship.addPost(CHANNEL, {
        authorId: '~zod',
        sequenceNum,
        blob: JSON.stringify([hostEvent(ops)]),
        kind: '/chat/surface/event',
      });
    at(5, [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }]);
    at(11, abortingOps('never-applies-a'));
    at(12, [{ op: 'set', path: '/bringing/~0wes', value: 'cake' }]);
    at(17, abortingOps('never-applies-b'));
    at(23, [{ op: 'set', path: '/bringing/~0nec', value: 'soup' }]);

    const revised = spec({ specRevision: 2, preserveState: true });
    addMirror(harness, revised);
    harness.ship.setChannelSpec(CHANNEL, revised);

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const refused = harness.json();
    expect(String(refused.message)).toContain('entries at sequences 11, 17');
    expect(
      (refused.details as Record<string, unknown>).abortedSequenceNums
    ).toEqual([11, 17]);

    expect(
      await run(
        ['snapshot', CHANNEL, '--allow-aborted-events', '--json'],
        harness.deps
      )
    ).toBe(0);
    expect(harness.json().abortedSequenceNums).toEqual([11, 17]);
  });

  /**
   * The laundering shape, one revision back (D199).
   *
   * The command's own fold, above, cannot see this one: the offending snapshot
   * belongs to revision 1, and snapshot selection drops a wrong-revision
   * candidate BEFORE it ever compares the boundary to the head. So the channel
   * reads as an ordinary stranded one and the repair path is reached.
   *
   * That repair then folds revision 1 deliberately — and that fold is a
   * WRITER's, because its state is posted as the revision-2 migration
   * snapshot. Folded without the head, the invalid boundary's state is carried
   * across into a snapshot every client accepts, while the bad snapshot goes on
   * winning selection at revision 1. Nothing is repaired; the corrupt state is
   * laundered.
   */
  function strandedOverSnapshot(
    upToSequenceNum: number,
    state: Record<string, unknown>
  ) {
    const harness = stranded();
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      kind: '/chat/surface/snapshot',
      blob: JSON.stringify([
        {
          type: 'surface-snapshot',
          version: 1,
          surfaceId: SURFACE_ID,
          specRevision: 1,
          upToSequenceNum,
          state,
        },
      ]),
    });
    return harness;
  }

  it('refuses the repair over a previous-revision snapshot beyond the head', async () => {
    const harness = strandedOverSnapshot(1_000_000, {
      bringing: { laundered: true },
    });
    const posts = (harness.ship.posts.get(CHANNEL) ?? []).length;

    // The premise: the CURRENT revision's fold is blind to it. This is not an
    // ordinary head-exceeded channel that any fold would refuse — it reads as
    // a plain stranded one, which is what makes the repair path the only
    // place the defect can be caught.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const before = harness.json();
    expect(before.status).toBe('migration-pending');
    expect(before.headExceededSnapshots).toEqual([]);

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('snapshot-head-exceeded');
    expect(
      (result.details as Record<string, unknown>).headExceededSnapshots
    ).toEqual([4]);

    // Counted against the write log, not read back off a final value: a
    // snapshot post cannot be unsent, so the only honest assertion is that
    // none was ever sent.
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(posts);
  });

  it('repairs across an honest previous-revision boundary', async () => {
    // The guard has to be able to NOT fire, or it is refusing the shape — a
    // revision-1 snapshot under a stranded revision 2 — rather than the
    // defect. Same fixture, same code path, a boundary the channel can have.
    const harness = strandedOverSnapshot(2, {
      bringing: { '~zod': 'bread', '~ten': 'pie', '~bus': 'wine' },
    });

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.repairedMigration).toBe(true);
    expect(result.carriedFromRevision).toBe(1);
    // The boundary the SNAPSHOT covered, not the newest post: the event at
    // sequence 2 is frozen under it, so nothing folded above it.
    expect(result.upToSequenceNum).toBe(2);

    // And the state carried across came THROUGH that snapshot — `~bus` is in
    // it and in no event, so this cannot be the fold a skipped snapshot would
    // have produced.
    const posted = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.id === result.post
    );
    expect(JSON.parse(posted?.blob ?? '[]')[0].state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie', '~bus': 'wine' },
    });
  });
});

/**
 * An entry that stopped early is a host's own failed write: state refused one
 * of its ops, so every op after that one never applied and the state is that
 * entry's partial prefix. Two things follow, and the reducer supplies neither.
 *
 * It has to be VISIBLE — a host that is told "folded 1, skipped 0" over a
 * half-applied entry has been told the write succeeded.
 *
 * And it must not be CHECKPOINTED by accident. A snapshot pairs the prefix
 * with a boundary that covers the aborted entry, so every later fold starts
 * above it: the entry is finalized as history that succeeded, and both the
 * lost ops and the fact that they were lost are gone for good.
 */
describe('surface — an entry that stopped early', () => {
  /**
   * `/bringing/~0zod` holds the string "bread", so writing through it is a
   * `structure` refusal — state cannot take the write, whatever the reducer
   * does about malformed ops. The second op is the one that proves the abort:
   * it is perfectly good, and it does not apply.
   */
  function abortedHarness() {
    const harness = setup();
    addEvent(
      harness,
      hostEvent([
        { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
        { op: 'set', path: '/bringing/~0ten', value: 'pie' },
      ])
    );
    return harness;
  }

  it('names the entry rather than folding it into a success', async () => {
    const harness = abortedHarness();
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    // The premise: the entry really did stop at its first op.
    expect(result.state).toEqual({ bringing: { '~zod': 'bread' } });
    expect(result.foldedEventCount).toBe(1);
    expect(result.skippedEventCount).toBe(0);
    expect(result.abortedSequenceNums).toEqual([1]);
  });

  it('says so in the plain report as well as the JSON one', async () => {
    const harness = abortedHarness();
    expect(await run(['state', CHANNEL], harness.deps)).toBe(0);
    expect(harness.out()).toContain('1 entry at sequence 1 stopped early');
  });

  it('refuses to snapshot over it, and says how to proceed', async () => {
    const harness = abortedHarness();
    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('usage');
    expect(String(result.message)).toContain('--allow-aborted-events');
    expect(
      (result.details as Record<string, unknown>).abortedSequenceNums
    ).toEqual([1]);
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(1);
  });

  it('finalizes the prefix only when the flag says to, and says it did', async () => {
    const harness = abortedHarness();
    expect(
      await run(
        ['snapshot', CHANNEL, '--allow-aborted-events', '--json'],
        harness.deps
      )
    ).toBe(0);
    const result = harness.json();
    expect(result.abortedSequenceNums).toEqual([1]);

    const posted = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (post) => post.kind === '/chat/surface/snapshot'
    );
    expect(JSON.parse(posted?.blob ?? '[]')[0].state).toEqual({
      bringing: { '~zod': 'bread' },
    });

    // And this is what the refusal is protecting against: from here on the
    // failed entry is under the boundary, so no fold ever reaches it again
    // and nothing reports that anything went wrong.
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const after = harness.json();
    expect(after.baseSnapshotSeq).toBe(1);
    expect(after.abortedSequenceNums).toEqual([]);
  });

  it('leaves a clean fold alone', async () => {
    const harness = setup();
    addEvent(
      harness,
      hostEvent([{ op: 'set', path: '/bringing/~0ten', value: 'pie' }])
    );
    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().abortedSequenceNums).toEqual([]);
  });

  /**
   * The audit trail, on the ordinary snapshot branch.
   *
   * Two aborts, at sequences that are neither adjacent to each other nor at
   * either end of the history, with clean entries before, between and after
   * them. A count cannot distinguish those from any other two; `[11, 17]` can
   * be wrong, which is what makes asserting it worth anything. This is also
   * the last moment anything names them: the snapshot the flag permits puts
   * both under the boundary, and the fold after it reports a clean history.
   */
  function multipleAbortsHarness() {
    const harness = setup();
    const abortingOps = (dish: string) => [
      { op: 'set', path: '/bringing/~0zod/loaf', value: 'sourdough' },
      { op: 'set', path: '/bringing/~0bus', value: dish },
    ];
    const at = (sequenceNum: number, ops: unknown[]) =>
      harness.ship.addPost(CHANNEL, {
        authorId: '~zod',
        sequenceNum,
        blob: JSON.stringify([hostEvent(ops)]),
        kind: '/chat/surface/event',
      });
    at(5, [{ op: 'set', path: '/bringing/~0ten', value: 'pie' }]);
    at(11, abortingOps('never-applies-a'));
    at(12, [{ op: 'set', path: '/bringing/~0wes', value: 'cake' }]);
    at(17, abortingOps('never-applies-b'));
    at(23, [{ op: 'set', path: '/bringing/~0nec', value: 'soup' }]);
    return harness;
  }

  it('names every aborted sequence in the fold report', async () => {
    const harness = multipleAbortsHarness();
    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    // The premise: two entries stopped, and the ops after each refusal did
    // not apply — `~bus` is missing from a state holding every clean entry.
    expect(result.state).toEqual({
      bringing: {
        '~zod': 'bread',
        '~ten': 'pie',
        '~wes': 'cake',
        '~nec': 'soup',
      },
    });
    expect(result.abortedSequenceNums).toEqual([11, 17]);

    expect(await run(['state', CHANNEL], harness.deps)).toBe(0);
    expect(harness.out()).toContain(
      '2 entries at sequences 11, 17 stopped early'
    );
  });

  it('names every aborted sequence the flag waives through', async () => {
    const harness = multipleAbortsHarness();

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const refused = harness.json();
    expect(String(refused.message)).toContain('entries at sequences 11, 17');
    expect(
      (refused.details as Record<string, unknown>).abortedSequenceNums
    ).toEqual([11, 17]);

    expect(
      await run(
        ['snapshot', CHANNEL, '--allow-aborted-events', '--json'],
        harness.deps
      )
    ).toBe(0);
    expect(harness.json().abortedSequenceNums).toEqual([11, 17]);

    // And in the human report, which is the only place a person reading the
    // terminal will ever see them.
    const plain = multipleAbortsHarness();
    expect(
      await run(['snapshot', CHANNEL, '--allow-aborted-events'], plain.deps)
    ).toBe(0);
    expect(plain.out()).toContain(
      '2 entries at sequences 11, 17 stopped early and were checkpointed anyway'
    );
  });
});

/**
 * The D175 head guard, on the CLI side.
 *
 * The client refuses a snapshot claiming coverage beyond the channel's
 * advertised head — a writer that put a millisecond timestamp in
 * `upToSequenceNum` freezes every event below it forever, and selection takes
 * the GREATEST boundary, so that snapshot wins for good. The cold review found
 * `advertisedHead` appeared nowhere in this package: the CLI folded from the
 * snapshot the client rejects, and `surface snapshot` would then write a fresh
 * one out of that fold — laundering the bad boundary into a record the client
 * WOULD accept, because the laundered one claims a boundary that exists.
 *
 * The head the CLI passes is the greatest sequence number the SHIP returned on
 * this call. It has no local store to compare against itself; every post here
 * came from the ship, and both commands already refuse a truncated page walk
 * before reducing.
 */
describe('surface state / snapshot — a snapshot beyond the channel head', () => {
  function withInflatedSnapshot() {
    const harness = setup();
    addEvent(
      harness,
      // `~0` is RFC 6901's escape for a literal `~`, so this writes the key
      // `~ten`. A bare `/bringing/~ten` is a malformed escape and the reducer
      // refuses the op.
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
          upToSequenceNum: 1_000_000,
          state: { bringing: { laundered: true } },
        },
      ]),
    });
    return harness;
  }

  it('state folds the real log and names the post it stepped over', async () => {
    const harness = withInflatedSnapshot();

    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    const result = harness.json();

    // the inflated snapshot did not win: the fold ran over the real events
    expect(result.state).toEqual({
      bringing: { '~zod': 'bread', '~ten': 'pie' },
    });
    expect(result.baseSnapshotSeq).toBe(null);
    // and the offending post is REPORTED, not merely skipped in silence
    expect(result.headExceededSnapshots).toEqual([2]);
  });

  it('snapshot refuses rather than writing one the bad boundary still beats', async () => {
    const harness = withInflatedSnapshot();
    const before = (harness.ship.posts.get(CHANNEL) ?? []).length;

    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('snapshot-head-exceeded');
    expect(result.message).toContain('beyond the channel');
    expect(
      (result.details as Record<string, unknown>).headExceededSnapshots
    ).toEqual([2]);

    // nothing written: a fresh snapshot here would claim a LOWER boundary than
    // the bad one, lose selection to it, and report a repair that changed
    // nothing.
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(before);
  });

  it('an honest snapshot at the head is still folded from', async () => {
    // The guard has to be able to NOT fire, or it is refusing the shape rather
    // than the defect.
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

    expect(await run(['state', CHANNEL, '--json'], harness.deps)).toBe(0);
    expect(harness.json().headExceededSnapshots).toEqual([]);
    expect(harness.json().baseSnapshotSeq).toBe(1);
  });
});
