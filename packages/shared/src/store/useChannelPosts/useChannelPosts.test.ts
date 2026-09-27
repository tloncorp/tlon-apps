import { afterEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getLatestChannelSequenceNum: vi.fn(),
  getChannel: vi.fn(),
}));

vi.mock('../../db', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getLatestChannelSequenceNum: dbMocks.getLatestChannelSequenceNum,
  getChannel: dbMocks.getChannel,
}));

import { useDebugStore } from '../../debug';
import { hasNewerPosts, isAtNewestPosts } from './useChannelPosts';

afterEach(() => {
  dbMocks.getLatestChannelSequenceNum.mockReset();
  dbMocks.getChannel.mockReset();
  useDebugStore.getState().initializeErrorLogger({ capture: () => {} });
});

describe('hasNewerPosts', () => {
  it('skips the sequence check for third-party channels', async () => {
    const capture = vi.fn();
    useDebugStore.getState().initializeErrorLogger({ capture });

    await expect(
      hasNewerPosts('notes/~litseb-sarfel/documents-1', [])
    ).resolves.toBe(false);

    // Notes never write `$posts` and `getChannelPosts` short-circuits them with
    // `newestSequenceNum: null`, so there is no watermark to read.
    expect(dbMocks.getLatestChannelSequenceNum).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('still reports the invariant for %channels-backed channels', async () => {
    const capture = vi.fn();
    useDebugStore.getState().initializeErrorLogger({ capture });
    dbMocks.getLatestChannelSequenceNum.mockResolvedValue(null);
    dbMocks.getChannel.mockResolvedValue({ id: 'chat/~zod/general' });

    await expect(hasNewerPosts('chat/~zod/general', [])).resolves.toBe(true);

    expect(dbMocks.getLatestChannelSequenceNum).toHaveBeenCalledWith({
      channelId: 'chat/~zod/general',
    });
    await vi.waitFor(() => {
      expect(capture).toHaveBeenCalledWith(
        'app_error',
        expect.objectContaining({
          errorTitle:
            'invariant violation: channel missing latest sequence number',
          channelId: 'chat/~zod/general',
          hasChannelRow: true,
        })
      );
    });
  });

  it('keeps reading the watermark for DMs', async () => {
    dbMocks.getLatestChannelSequenceNum.mockResolvedValue(0);

    await expect(hasNewerPosts('~solfer-magfed', [])).resolves.toBe(false);

    expect(dbMocks.getLatestChannelSequenceNum).toHaveBeenCalledWith({
      channelId: '~solfer-magfed',
    });
  });
});

describe('isAtNewestPosts', () => {
  it('is at newest when the query has no newer page', () => {
    expect(
      isAtNewestPosts({
        hasPreviousPage: false,
        wasAtNewest: false,
        newPostCount: 0,
      })
    ).toBe(true);
  });

  it('stays at newest when a refetch reports a newer page after live posts', () => {
    expect(
      isAtNewestPosts({
        hasPreviousPage: true,
        wasAtNewest: true,
        newPostCount: 1,
      })
    ).toBe(true);
  });

  it('is not at newest when the query never reached the newest post', () => {
    expect(
      isAtNewestPosts({
        hasPreviousPage: true,
        wasAtNewest: false,
        newPostCount: 3,
      })
    ).toBe(false);
  });

  it('is not at newest when no posts have been heard since the regression', () => {
    expect(
      isAtNewestPosts({
        hasPreviousPage: true,
        wasAtNewest: true,
        newPostCount: 0,
      })
    ).toBe(false);
  });
});
