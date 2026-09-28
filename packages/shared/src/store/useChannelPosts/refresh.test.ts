import { describe, expect, it, vi } from 'vitest';

import {
  refreshStaleChannelPosts,
  supportsChangedPostsRefresh,
} from './refresh';

const sessionStartTime = 1_000;

function post(id: string, syncedAt: number | null = 0) {
  return { id, syncedAt };
}

function setup(
  overrides: Partial<Parameters<typeof refreshStaleChannelPosts>[0]> = {}
) {
  const pendingPostIds = new Set<string>();
  const refreshPosts = vi.fn().mockResolvedValue({});
  const onError = vi.fn();
  const options: Parameters<typeof refreshStaleChannelPosts>[0] = {
    channelId: 'chat/~zod/general',
    posts: [post('newest'), post('oldest')],
    session: { startTime: sessionStartTime },
    pendingPostIds,
    refreshPosts,
    onError,
    ...overrides,
  };

  refreshStaleChannelPosts(options);

  return {
    options,
    pendingPostIds: options.pendingPostIds,
    refreshPosts,
    onError,
  };
}

describe('supportsChangedPostsRefresh', () => {
  it.each([
    ['chat/~zod/general', true],
    ['heap/~zod/gallery', true],
    ['~pinser-botter-podfyl-parseb', false],
    ['0v4.00000.qd4mk.d4htu.er4b8.eao21', false],
  ])('classifies %s', (channelId, expected) => {
    expect(supportsChangedPostsRefresh(channelId)).toBe(expected);
  });
});

describe('refreshStaleChannelPosts', () => {
  it('does not refresh before a sync session exists', () => {
    const { pendingPostIds, refreshPosts } = setup({ session: null });

    expect(refreshPosts).not.toHaveBeenCalled();
    expect(pendingPostIds).toEqual(new Set());
  });

  it.each([
    ['a DM', '~pinser-botter-podfyl-parseb'],
    ['a group DM', '0v4.00000.qd4mk.d4htu.er4b8.eao21'],
  ])('does not request changed posts for %s', (_label, channelId) => {
    const { pendingPostIds, refreshPosts } = setup({ channelId });

    expect(refreshPosts).not.toHaveBeenCalled();
    expect(pendingPostIds).toEqual(new Set());
  });

  it('requests stale group-channel posts with bounded cursors', () => {
    const { pendingPostIds, refreshPosts } = setup({
      posts: [
        post('newest-stale'),
        post('already-pending'),
        post('fresh', sessionStartTime),
        post('oldest-stale', null),
      ],
      pendingPostIds: new Set(['already-pending']),
    });

    expect(refreshPosts).toHaveBeenCalledOnce();
    expect(refreshPosts).toHaveBeenCalledWith(
      {
        channelId: 'chat/~zod/general',
        startCursor: 'oldest-stale',
        endCursor: 'newest-stale',
        afterTime: new Date(sessionStartTime),
      },
      { priority: 4 }
    );
    expect(pendingPostIds).toEqual(
      new Set(['already-pending', 'newest-stale', 'oldest-stale'])
    );
  });

  it('chunks changed-post requests in groups of 50', () => {
    const posts = Array.from({ length: 51 }, (_, index) =>
      post(`post-${index}`)
    );
    const { refreshPosts } = setup({ posts });

    expect(refreshPosts).toHaveBeenCalledTimes(2);
    expect(refreshPosts.mock.calls[0][0]).toMatchObject({
      startCursor: 'post-49',
      endCursor: 'post-0',
    });
    expect(refreshPosts.mock.calls[1][0]).toMatchObject({
      startCursor: 'post-50',
      endCursor: 'post-50',
    });
  });

  it('clears failed posts so a later refresh can retry them', async () => {
    const failure = new Error('temporary failure');
    const pendingPostIds = new Set<string>();
    const refreshPosts = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({});
    const onError = vi.fn();
    const options = {
      channelId: 'chat/~zod/general',
      posts: [post('stale')],
      session: { startTime: sessionStartTime },
      pendingPostIds,
      refreshPosts,
      onError,
    };

    refreshStaleChannelPosts(options);
    expect(pendingPostIds).toEqual(new Set(['stale']));

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(failure));
    expect(pendingPostIds).toEqual(new Set());

    refreshStaleChannelPosts(options);
    expect(refreshPosts).toHaveBeenCalledTimes(2);
    expect(pendingPostIds).toEqual(new Set(['stale']));
  });
});
