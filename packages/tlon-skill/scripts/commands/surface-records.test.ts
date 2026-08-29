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

  it('refuses to snapshot a surface that has no state to snapshot', async () => {
    const harness = setup({ spec: spec({ preserveState: true }) });
    expect(await run(['snapshot', CHANNEL, '--json'], harness.deps)).toBe(1);
    expect(harness.json().code).toBe('migration-pending');
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
