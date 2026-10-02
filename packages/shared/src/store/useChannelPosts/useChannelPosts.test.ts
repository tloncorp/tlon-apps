import { afterEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  getLatestChannelSequenceNum: vi.fn(),
  getChannel: vi.fn(),
}));
const syncPosts = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock('../../db', async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getLatestChannelSequenceNum: dbMocks.getLatestChannelSequenceNum,
  getChannel: dbMocks.getChannel,
}));

vi.mock('../sync', () => ({ syncPosts }));

import type { Post } from '../../db';
import { useDebugStore } from '../../debug';
import { hasNewerPosts } from './useChannelPosts';

afterEach(() => {
  dbMocks.getLatestChannelSequenceNum.mockReset();
  dbMocks.getChannel.mockReset();
  syncPosts.mockClear();
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

    expect(syncPosts).toHaveBeenCalledTimes(1);
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
          localPostCount: 0,
        })
      );
    });
  });

  it('seeds a missing watermark with one newest sync before reporting', async () => {
    const capture = vi.fn();
    useDebugStore.getState().initializeErrorLogger({ capture });
    dbMocks.getLatestChannelSequenceNum
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(0);
    let finishSync = () => {};
    syncPosts.mockReturnValueOnce(
      new Promise((r) => (finishSync = () => r({})))
    );

    const result = hasNewerPosts('~solfer-magfed', []);
    await vi.waitFor(() => expect(syncPosts).toHaveBeenCalledTimes(1));
    // The re-read must wait for the sync, or it sees the unseeded row.
    expect(dbMocks.getLatestChannelSequenceNum).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
    finishSync();
    await expect(result).resolves.toBe(false);

    expect(dbMocks.getLatestChannelSequenceNum).toHaveBeenCalledTimes(2);
    expect(syncPosts).toHaveBeenCalledWith(
      { channelId: '~solfer-magfed', mode: 'newest', count: 1 },
      expect.anything()
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not hold local posts behind the watermark repair', async () => {
    const capture = vi.fn();
    useDebugStore.getState().initializeErrorLogger({ capture });
    dbMocks.getLatestChannelSequenceNum.mockResolvedValue(null);
    syncPosts.mockReturnValueOnce(new Promise(() => {}));
    const posts = [{ id: 'p1', sequenceNum: 5 } as Post];

    await expect(hasNewerPosts('~solfer-magfed', posts)).resolves.toBe(true);
    expect(syncPosts).toHaveBeenCalledTimes(1);
    expect(capture).not.toHaveBeenCalled();
  });

  it('keeps reading the watermark for DMs', async () => {
    dbMocks.getLatestChannelSequenceNum.mockResolvedValue(0);

    await expect(hasNewerPosts('~solfer-magfed', [])).resolves.toBe(false);

    expect(dbMocks.getLatestChannelSequenceNum).toHaveBeenCalledWith({
      channelId: '~solfer-magfed',
    });
  });
});
