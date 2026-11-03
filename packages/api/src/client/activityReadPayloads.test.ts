import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  activityAction,
  getGroupAndChannelUnreads,
  readChannel,
} from './activityApi';
import {
  poke,
  scry,
  setActivitySupportsNotes,
  setActivitySupportsReactions,
} from './urbit';

// The wire payloads `tlon activity mark-read` relies on, through the real
// helpers: the CLI's own suite runs against a mocked @tloncorp/api.
vi.mock('./urbit', async () => {
  const actual = await vi.importActual<typeof import('./urbit')>('./urbit');

  return {
    ...actual,
    poke: vi.fn(),
    scry: vi.fn(),
  };
});

const GROUP = '~zod/book-club';
const deepRead = (source: unknown) => ({
  app: 'activity',
  mark: 'activity-action-2',
  json: { read: { source, action: { all: { time: null, deep: true } } } },
});

beforeEach(() => {
  vi.mocked(poke).mockReset();
  vi.mocked(scry).mockReset();
  setActivitySupportsReactions(true);
  setActivitySupportsNotes(true);
});

afterEach(() => {
  setActivitySupportsReactions(false);
  setActivitySupportsNotes(false);
});

describe('mark-read wire payloads', () => {
  const cases: Array<{ name: string; send: () => unknown; poke: unknown }> = [
    {
      name: 'a DM',
      send: () =>
        readChannel({ channelId: '~ten', channelType: 'dm', deep: true }),
      poke: deepRead({ dm: { ship: '~ten' } }),
    },
    {
      name: 'a group DM',
      send: () =>
        readChannel({
          channelId: '0v1f.abcde',
          channelType: 'groupDm',
          deep: true,
        }),
      poke: deepRead({ dm: { club: '0v1f.abcde' } }),
    },
    {
      name: 'a channel',
      send: () =>
        readChannel({
          channelId: 'chat/~nec/general',
          channelType: 'chat',
          groupId: GROUP,
          deep: true,
        }),
      poke: deepRead({ channel: { nest: 'chat/~nec/general', group: GROUP } }),
    },
    {
      name: 'a gallery channel',
      send: () =>
        readChannel({
          channelId: 'heap/~nec/pics',
          channelType: 'gallery',
          groupId: GROUP,
          deep: true,
        }),
      poke: deepRead({ channel: { nest: 'heap/~nec/pics', group: GROUP } }),
    },
    {
      name: 'a group',
      send: () =>
        poke(
          activityAction({
            read: {
              source: { group: GROUP },
              action: { all: { time: null, deep: true } },
            },
          })
        ),
      poke: deepRead({ group: GROUP }),
    },
    {
      name: 'everything',
      send: () =>
        poke(
          activityAction({
            read: {
              source: { base: null },
              action: { all: { time: null, deep: true } },
            },
          })
        ),
      poke: deepRead({ base: null }),
    },
  ];

  for (const testCase of cases) {
    test(`reads ${testCase.name} with one deep read on activity-action-2`, async () => {
      await testCase.send();

      expect(vi.mocked(poke).mock.calls).toEqual([[testCase.poke]]);
    });
  }

  test('reads the summaries from /v6/activity', async () => {
    vi.mocked(scry).mockResolvedValue({});

    await getGroupAndChannelUnreads();

    expect(vi.mocked(scry).mock.calls).toEqual([
      [{ app: 'activity', path: '/v6/activity' }],
    ]);
  });
});
