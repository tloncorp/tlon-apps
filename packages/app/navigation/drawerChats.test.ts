import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import { DRAWER_CHAT_LIMIT, getDrawerChats } from './drawerChats';

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

describe('getDrawerChats', () => {
  it('flattens the buckets and orders the whole list by recency', () => {
    const sorted = getDrawerChats({
      pinned: [group('pinned-old', 10)],
      unpinned: [group('newest', 30), group('oldest', 5)],
      pending: [group('invite', 20)],
    });

    expect(sorted.map((c) => c.id)).toEqual([
      'newest',
      'invite',
      'pinned-old',
      'oldest',
    ]);
  });

  it('lists groups and direct messages, not the channels inside a group', () => {
    const chats = getDrawerChats({
      pinned: [],
      unpinned: [
        group('a-group', 40),
        channel('a-dm', 30, 'dm'),
        channel('a-group-dm', 20, 'groupDm'),
        channel('a-group-channel', 10, 'chat'),
      ],
      pending: [],
    });

    expect(chats.map((c) => c.id)).toEqual(['a-group', 'a-dm', 'a-group-dm']);
  });

  it('keeps a group channel the user pinned to the top level', () => {
    const chats = getDrawerChats({
      pinned: [channel('pinned-channel', 10, 'chat', { index: 0 } as db.Pin)],
      unpinned: [],
      pending: [],
    });

    expect(chats.map((c) => c.id)).toEqual(['pinned-channel']);
  });

  it('keeps the newest up to the limit, and drops the rest', () => {
    const many = Array.from({ length: DRAWER_CHAT_LIMIT + 25 }, (_, i) =>
      group(`chat-${i}`, i)
    );

    const chats = getDrawerChats({
      pinned: [],
      unpinned: many,
      pending: [],
    });

    expect(chats).toHaveLength(DRAWER_CHAT_LIMIT);
    // Newest first, so the highest timestamps survive the cut.
    expect(chats[0].id).toBe(`chat-${DRAWER_CHAT_LIMIT + 24}`);
    expect(chats.at(-1)?.id).toBe(`chat-25`);
  });

  it('is empty before the chats have loaded', () => {
    expect(getDrawerChats(undefined)).toEqual([]);
    expect(getDrawerChats(null)).toEqual([]);
  });

  it('leaves the query result untouched', () => {
    const chats = {
      pinned: [],
      unpinned: [group('a', 1), group('b', 2)],
      pending: [],
    };

    getDrawerChats(chats);

    expect(chats.unpinned.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
