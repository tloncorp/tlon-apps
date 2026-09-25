import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  chatMatchesDrawerFilter,
  getDrawerChats,
  getDrawerSearchChats,
  getDrawerSearchRows,
  getUnreadDrawerFilters,
} from './drawerChats';

function group(id: string, timestamp: number): db.Chat {
  return {
    id,
    timestamp,
    pin: null,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'group',
    group: { id } as db.Group,
  };
}

function channel(
  id: string,
  timestamp: number,
  type: db.Channel['type'],
  pin: db.Pin | null = null
): db.Chat {
  return {
    id,
    timestamp,
    pin,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'channel',
    channel: { id, type } as db.Channel,
  };
}

describe('chatMatchesDrawerFilter', () => {
  it('sends direct messages to one tab and everything else to the other', () => {
    const cases: [db.Chat, 'workspaces' | 'messages'][] = [
      [group('a-group', 1), 'workspaces'],
      [channel('a-dm', 1, 'dm'), 'messages'],
      [channel('a-group-dm', 1, 'groupDm'), 'messages'],
      [
        channel('a-pinned-channel', 1, 'chat', { index: 0 } as db.Pin),
        'workspaces',
      ],
    ];

    for (const [chat, tab] of cases) {
      expect(chatMatchesDrawerFilter(chat, 'workspaces')).toBe(
        tab === 'workspaces'
      );
      expect(chatMatchesDrawerFilter(chat, 'messages')).toBe(
        tab === 'messages'
      );
    }
  });
});

describe('getDrawerChats', () => {
  it('flattens the buckets and orders the whole list by recency', () => {
    const sorted = getDrawerChats(
      {
        pinned: [group('pinned-old', 10)],
        unpinned: [group('newest', 30), group('oldest', 5)],
        pending: [group('invite', 20)],
      },
      'workspaces'
    );

    expect(sorted.map((c) => c.id)).toEqual([
      'newest',
      'invite',
      'pinned-old',
      'oldest',
    ]);
  });

  it('lists a tab’s own chats, and not the channels inside a group', () => {
    const chats = {
      pinned: [],
      unpinned: [
        group('a-group', 40),
        channel('a-dm', 30, 'dm'),
        channel('a-group-dm', 20, 'groupDm'),
        channel('a-group-channel', 10, 'chat'),
      ],
      pending: [],
    };

    expect(getDrawerChats(chats, 'workspaces').map((c) => c.id)).toEqual([
      'a-group',
    ]);
    expect(getDrawerChats(chats, 'messages').map((c) => c.id)).toEqual([
      'a-dm',
      'a-group-dm',
    ]);
  });

  it('keeps a group channel the user pinned to the top level, under Workspaces', () => {
    const chats = {
      pinned: [channel('pinned-channel', 10, 'chat', { index: 0 } as db.Pin)],
      unpinned: [],
      pending: [],
    };

    expect(getDrawerChats(chats, 'workspaces').map((c) => c.id)).toEqual([
      'pinned-channel',
    ]);
    expect(getDrawerChats(chats, 'messages')).toEqual([]);
  });

  it('leaves out the conversation the footer already carries', () => {
    const chats = {
      pinned: [],
      unpinned: [channel('bot-dm', 20, 'dm'), channel('a-dm', 10, 'dm')],
      pending: [],
    };

    expect(
      getDrawerChats(chats, 'messages', 'bot-dm').map((c) => c.id)
    ).toEqual(['a-dm']);
  });

  it('is empty before the chats have loaded', () => {
    expect(getDrawerChats(undefined, 'workspaces')).toEqual([]);
    expect(getDrawerChats(null, 'messages')).toEqual([]);
  });

  it('leaves the query result untouched', () => {
    const chats = {
      pinned: [],
      unpinned: [group('a', 1), group('b', 2)],
      pending: [],
    };

    getDrawerChats(chats, 'workspaces');

    expect(chats.unpinned.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('getUnreadDrawerFilters', () => {
  function unread(chat: db.Chat, count: number): db.Chat {
    return { ...chat, unreadCount: count };
  }

  function mutedGroup(channels: db.Channel[], unreadCount: number): db.Chat {
    return {
      id: 'a-group',
      timestamp: 40,
      pin: null,
      volumeSettings: { level: 'hush' } as db.VolumeSettings,
      isPending: false,
      unreadCount,
      type: 'group',
      group: { id: 'a-group', channels } as db.Group,
    };
  }

  it('names the tab an unread is sitting under', () => {
    const chats = {
      pinned: [],
      unpinned: [unread(group('a-group', 40), 3), channel('a-dm', 30, 'dm')],
      pending: [],
    };

    expect(getUnreadDrawerFilters(chats)).toEqual(['workspaces']);
  });

  it('names both when each half is holding one', () => {
    const chats = {
      pinned: [],
      unpinned: [
        unread(group('a-group', 40), 1),
        unread(channel('a-dm', 30, 'dm'), 2),
      ],
      pending: [],
    };

    expect(getUnreadDrawerFilters(chats)).toEqual(['workspaces', 'messages']);
  });

  it('counts a chat notified with no unread count, as the rows do', () => {
    const notified: db.Chat = {
      id: 'a-dm',
      timestamp: 30,
      pin: null,
      volumeSettings: null,
      isPending: false,
      unreadCount: 0,
      type: 'channel',
      channel: {
        id: 'a-dm',
        type: 'dm',
        unread: { notify: true },
      } as db.Channel,
    };

    expect(
      getUnreadDrawerFilters({
        pinned: [],
        unpinned: [notified],
        pending: [],
      })
    ).toEqual(['messages']);
  });

  it('stays quiet for a chat the user muted', () => {
    const muted: db.Chat = {
      ...unread(channel('a-dm', 30, 'dm'), 5),
      volumeSettings: { level: 'hush' } as db.VolumeSettings,
    };

    expect(
      getUnreadDrawerFilters({
        pinned: [],
        unpinned: [muted],
        pending: [],
      })
    ).toEqual([]);
  });

  it('ignores the conversation the footer carries, as the list does', () => {
    const chats = {
      pinned: [],
      unpinned: [unread(channel('bot-dm', 30, 'dm'), 4)],
      pending: [],
    };

    expect(getUnreadDrawerFilters(chats)).toEqual(['messages']);
    expect(getUnreadDrawerFilters(chats, 'bot-dm')).toEqual([]);
  });

  it('hears a channel turned back up inside a muted workspace', () => {
    const channels = [
      { id: 'quiet', currentUserIsMember: true } as db.Channel,
      {
        id: 'loud',
        currentUserIsMember: true,
        unread: { count: 2 },
        volumeSettings: { level: 'loud' },
      } as db.Channel,
    ];
    const mutedWorkspace = mutedGroup(channels, 0);

    expect(
      getUnreadDrawerFilters({
        pinned: [],
        unpinned: [mutedWorkspace],
        pending: [],
      })
    ).toEqual(['workspaces']);
  });

  it('stays quiet when a muted workspace has no channel of its own to speak', () => {
    const channels = [
      {
        id: 'a',
        currentUserIsMember: true,
        unread: { count: 2 },
      } as db.Channel,
      {
        id: 'b',
        currentUserIsMember: true,
        unread: { count: 1 },
      } as db.Channel,
    ];
    const mutedWorkspace = mutedGroup(channels, 3);

    expect(
      getUnreadDrawerFilters({
        pinned: [],
        unpinned: [mutedWorkspace],
        pending: [],
      })
    ).toEqual([]);
  });

  it('is empty before the chats have loaded', () => {
    expect(getUnreadDrawerFilters(undefined)).toEqual([]);
    expect(getUnreadDrawerFilters(null)).toEqual([]);
  });
});

describe('getDrawerSearchChats', () => {
  it('looks through both tabs at once, newest first', () => {
    const chats = {
      pinned: [group('pinned-group', 10)],
      unpinned: [
        channel('a-dm', 40, 'dm'),
        group('a-group', 30),
        channel('a-group-channel', 20, 'chat'),
      ],
      pending: [group('invite', 35)],
    };

    expect(getDrawerSearchChats(chats).map((c) => c.id)).toEqual([
      'a-dm',
      'invite',
      'a-group',
      'pinned-group',
    ]);
  });

  it('leaves out the conversation the footer already carries', () => {
    const chats = {
      pinned: [],
      unpinned: [channel('bot-dm', 20, 'dm'), channel('a-dm', 10, 'dm')],
      pending: [],
    };

    expect(getDrawerSearchChats(chats, 'bot-dm').map((c) => c.id)).toEqual([
      'a-dm',
    ]);
  });

  it('is empty before the chats have loaded', () => {
    expect(getDrawerSearchChats(undefined)).toEqual([]);
    expect(getDrawerSearchChats(null)).toEqual([]);
  });
});

describe('getDrawerSearchRows', () => {
  function workspace(id: string, channelIds: string[]): db.Chat {
    return {
      id,
      timestamp: 1,
      pin: null,
      volumeSettings: null,
      isPending: false,
      unreadCount: 0,
      type: 'group',
      group: {
        id,
        channels: channelIds.map(
          (channelId) =>
            ({ id: channelId, currentUserIsMember: true }) as db.Channel
        ),
      } as db.Group,
    };
  }

  function keys(rows: ReturnType<typeof getDrawerSearchRows>) {
    return rows.map((row) => row.key);
  }

  it('heads each half with its tab, workspaces first, in the ranked order', () => {
    const results = [
      channel('dm-best', 1, 'dm'),
      group('group-best', 1),
      channel('dm-next', 1, 'groupDm'),
      group('group-next', 1),
    ];

    expect(keys(getDrawerSearchRows(results, null))).toEqual([
      'heading:workspaces',
      'group-best',
      'group-next',
      'heading:messages',
      'dm-best',
      'dm-next',
    ]);
  });

  it('gives a half with nothing in it no heading', () => {
    expect(keys(getDrawerSearchRows([channel('a-dm', 1, 'dm')], null))).toEqual(
      ['heading:messages', 'a-dm']
    );
    expect(getDrawerSearchRows([], null)).toEqual([]);
  });

  it('lays out the unfurled workspace’s channels under it', () => {
    const rows = getDrawerSearchRows(
      [workspace('a-group', ['one', 'two'])],
      'a-group'
    );

    expect(keys(rows)).toEqual([
      'heading:workspaces',
      'a-group',
      'a-group:one',
      'a-group:two',
    ]);
  });
});
