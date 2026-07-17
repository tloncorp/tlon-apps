import { describe, expect, it, vi } from 'vitest';

import { fetchAllChannels, fetchInitData } from './discovery.js';

const runtime = { log: vi.fn(), error: vi.fn() } as any;

function makeApi(initData: unknown) {
  return {
    scry: vi.fn(async (path: string) => {
      if (path === '/groups-ui/v7/init.json') {
        return initData;
      }
      throw new Error(`unexpected scry: ${path}`);
    }),
  };
}

const INIT_DATA = {
  groups: {
    '~zod/gardening': {
      meta: { title: 'Gardening' },
      channels: {
        'chat/~zod/general': { meta: { title: 'General' } },
        'heap/~zod/photos': { meta: { title: 'Photos' } },
        'diary/~zod/journal': { meta: { title: 'Journal' } },
        'notes/~zod/plans': { meta: { title: 'Plans' } },
      },
    },
    '~nec/reading': {
      meta: { title: 'Reading' },
      channels: {
        'chat/~nec/lounge': { meta: { title: 'Lounge' } },
        'notes/~nec/library': {},
      },
    },
  },
  foreigns: null,
};

describe('fetchInitData', () => {
  it('collects chat/heap/diary nests as channels', async () => {
    const result = await fetchInitData(makeApi(INIT_DATA), runtime);
    expect(result.channels.sort()).toEqual([
      'chat/~nec/lounge',
      'chat/~zod/general',
      'diary/~zod/journal',
      'heap/~zod/photos',
    ]);
    expect(result.channelToGroup.get('chat/~zod/general')).toBe(
      '~zod/gardening'
    );
    expect(result.channelNames.get('heap/~zod/photos')).toBe('Photos');
    expect(result.groupNames.get('~zod/gardening')).toBe('Gardening');
  });

  it('collects notes/ nests as notebooks, not channels', async () => {
    const result = await fetchInitData(makeApi(INIT_DATA), runtime);
    expect(result.channels).not.toContain('notes/~zod/plans');
    expect(result.channels).not.toContain('notes/~nec/library');
    expect(result.notebookToGroup.get('notes/~zod/plans')).toBe(
      '~zod/gardening'
    );
    expect(result.notebookToGroup.get('notes/~nec/library')).toBe(
      '~nec/reading'
    );
    expect(result.notebookNames.get('notes/~zod/plans')).toBe('Plans');
    expect(result.notebookNames.has('notes/~nec/library')).toBe(false);
  });

  it('returns empty maps when the scry fails', async () => {
    const api = {
      scry: vi.fn(async () => {
        throw new Error('scry failed');
      }),
    };
    const result = await fetchInitData(api, runtime);
    expect(result.channels).toEqual([]);
    expect(result.notebookToGroup.size).toBe(0);
    expect(result.notebookNames.size).toBe(0);
    expect(result.foreigns).toBeNull();
  });
});

describe('fetchAllChannels', () => {
  it('returns only message channels, never notebooks', async () => {
    const channels = await fetchAllChannels(makeApi(INIT_DATA), runtime);
    expect(channels).toHaveLength(4);
    expect(channels.some((nest) => nest.startsWith('notes/'))).toBe(false);
  });
});
