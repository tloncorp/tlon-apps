import { beforeEach, describe, expect, test, vi } from 'vitest';

import { encodeString } from '../urbit/utils';
import {
  type GlobalSearchPage,
  globalSearchChannelId,
  searchGlobally,
} from './globalSearchApi';
import { scry } from './urbit';

vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');
  return { ...actual, scry: vi.fn() };
});

const emptyPage: GlobalSearchPage = {
  hits: [],
  next: null,
  complete: true,
  indexed: 0,
  sources: { channels: 0, clubs: 0, dms: 0 },
  builtAt: null,
};

beforeEach(() => {
  vi.mocked(scry).mockReset();
  vi.mocked(scry).mockResolvedValue(emptyPage);
});

describe('global search API', () => {
  test('renders every source as a client channel id', () => {
    expect(
      globalSearchChannelId({
        type: 'channel',
        kind: 'chat',
        ship: '~zod',
        name: 'general',
      })
    ).toBe('chat/~zod/general');
    expect(globalSearchChannelId({ type: 'dm', ship: '~nec' })).toBe('~nec');
    expect(globalSearchChannelId({ type: 'club', id: '0v7' })).toBe('0v7');
  });

  test('encodes the query and opaque pagination cursor in the scry path', async () => {
    await searchGlobally({ query: 'hello world', limit: 25, cursor: '0w123' });

    expect(scry).toHaveBeenCalledWith({
      app: 'groups-ui',
      path: `/global-search/25/0w123/${encodeString('hello world')}`,
    });
  });
});
