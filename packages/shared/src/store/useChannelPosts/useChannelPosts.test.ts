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
import { hasNewerPosts } from './useChannelPosts';

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
