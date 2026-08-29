import { describe, expect, it } from 'bun:test';

import { createTestSurfaceDeps } from '../surface-test-doubles';
import { SurfaceError } from './surface-common';
import { hydratePosts, postSurfaceRecord } from './surface-writer';

const CHANNEL = 'chat/~zod/dash';

function entry(revision = 1) {
  return {
    type: 'surface-event',
    version: 1,
    surfaceId: 'srf',
    specRevision: revision,
    mode: 'host',
    ops: [{ op: 'del', path: '/x' }],
  };
}

describe('postSurfaceRecord', () => {
  it('validates the entry against the shared schema before poking', async () => {
    const harness = createTestSurfaceDeps({});
    await expect(
      postSurfaceRecord(harness.deps, {
        channelId: CHANNEL,
        kind: 'event',
        entry: { type: 'surface-event', version: 1, mode: 'host' },
        fallback: 'x',
      })
    ).rejects.toThrow(SurfaceError);
    expect(harness.ship.posts.get(CHANNEL) ?? []).toHaveLength(0);
  });

  it('refuses when the post never appears, even though the poke resolved', async () => {
    const harness = createTestSurfaceDeps({
      overrides: {
        // A poke that resolves and does nothing: exactly what an untracked
        // %channels poke looks like when %channels-server drops it.
        sendSurfacePost: async () => {},
      },
    });
    const failure = await postSurfaceRecord(harness.deps, {
      channelId: CHANNEL,
      kind: 'event',
      entry: entry(),
      fallback: 'x',
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SurfaceError);
    expect((failure as SurfaceError).code).toBe('post-unconfirmed');
  });

  it('matches its own post rather than the newest one', async () => {
    const harness = createTestSurfaceDeps({});
    // Someone else's post arrives first and stays newest by sequence.
    harness.ship.addPost(CHANNEL, {
      authorId: '~ten',
      blob: JSON.stringify([entry()]),
      kind: '/chat/surface/event',
      sequenceNum: 99,
    });

    const written = await postSurfaceRecord(harness.deps, {
      channelId: CHANNEL,
      kind: 'event',
      entry: entry(2),
      fallback: 'x',
    });
    const post = (harness.ship.posts.get(CHANNEL) ?? []).find(
      (candidate) => candidate.id === written.postId
    );
    expect(post?.authorId).toBe('~zod');
    expect(JSON.parse(post?.blob ?? '[]')[0].specRevision).toBe(2);
  });

  it('refuses a matching post that was already there before the write', async () => {
    const harness = createTestSurfaceDeps({
      overrides: {
        // `sent` is sender-supplied (D53), so two runs of the same command
        // can carry the same one — a concurrent identical command, or a
        // retry within the same millisecond.
        now: () => 1_700_000_000_042,
        // The poke that resolves and does nothing.
        sendSurfacePost: async () => {},
      },
    });
    harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      sentAt: 1_700_000_000_042,
      blob: JSON.stringify([entry()]),
      kind: '/chat/surface/event',
    });

    const failure = await postSurfaceRecord(harness.deps, {
      channelId: CHANNEL,
      kind: 'event',
      entry: entry(),
      fallback: 'x',
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SurfaceError);
    expect((failure as SurfaceError).code).toBe('post-unconfirmed');
    expect((failure as SurfaceError).details.matchedExistingPost).toBe(
      'post-1'
    );
  });

  it('still confirms a real write that a matching older post sits under', async () => {
    const harness = createTestSurfaceDeps({
      overrides: { now: () => 1_700_000_000_042 },
    });
    const existing = harness.ship.addPost(CHANNEL, {
      authorId: '~zod',
      sentAt: 1_700_000_000_042,
      blob: JSON.stringify([entry()]),
      kind: '/chat/surface/event',
    });

    const written = await postSurfaceRecord(harness.deps, {
      channelId: CHANNEL,
      kind: 'event',
      entry: entry(),
      fallback: 'x',
    });
    expect(written.postId).not.toBe(existing.id);
    expect(written.sequenceNum).toBeGreaterThan(existing.sequenceNum ?? 0);
  });

  it('refuses a post that came back without its surface kind', async () => {
    const harness = createTestSurfaceDeps({
      overrides: { readPostKind: async () => '/chat' },
    });
    const failure = await postSurfaceRecord(harness.deps, {
      channelId: CHANNEL,
      kind: 'event',
      entry: entry(),
      fallback: 'x',
    }).catch((error: unknown) => error);

    expect((failure as SurfaceError).code).toBe('kind-tail-lost');
  });
});

describe('hydratePosts', () => {
  it('pages to the start of the channel and says so', async () => {
    const harness = createTestSurfaceDeps({ pageSize: 2 });
    for (let index = 0; index < 5; index += 1) {
      harness.ship.addPost(CHANNEL, {});
    }
    const hydrated = await hydratePosts(harness.deps, CHANNEL, { pageSize: 2 });
    expect(hydrated.posts).toHaveLength(5);
    expect(hydrated.complete).toBe(true);
    expect(hydrated.pages).toBeGreaterThan(1);
  });

  it('reports an incomplete read rather than a short history', async () => {
    const harness = createTestSurfaceDeps({ pageSize: 1 });
    for (let index = 0; index < 5; index += 1) {
      harness.ship.addPost(CHANNEL, {});
    }
    const hydrated = await hydratePosts(harness.deps, CHANNEL, {
      pageSize: 1,
      maxPosts: 3,
    });
    expect(hydrated.posts).toHaveLength(3);
    expect(hydrated.complete).toBe(false);
  });

  it('stops rather than looping when a cursor stops advancing', async () => {
    const harness = createTestSurfaceDeps({
      overrides: {
        readPostPage: async () => ({ posts: [], older: '0', totalPosts: 10 }),
      },
    });
    const hydrated = await hydratePosts(harness.deps, CHANNEL);
    expect(hydrated.complete).toBe(false);
    expect(hydrated.pages).toBe(1);
  });
});
