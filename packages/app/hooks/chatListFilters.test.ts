import * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  type ChatListFilter,
  chatMatchesListFilter,
  filterChatsByListFilter,
} from './chatListFilters';

const ME = '~ten';
const BOT = '~pinser-botter-ten';
const ids = { currentUserId: ME, botUserId: BOT };

function groupChat(
  id: string,
  memberIds: string[],
  memberCount = memberIds.length
): db.Chat {
  return {
    id,
    type: 'group',
    pin: null,
    volumeSettings: null,
    timestamp: 0,
    isPending: false,
    unreadCount: 0,
    group: {
      id,
      memberCount,
      members: memberIds.map((contactId) => ({ contactId })),
    },
  } as unknown as db.Chat;
}

function channelChat(id: string, type: string): db.Chat {
  return {
    id,
    type: 'channel',
    pin: null,
    volumeSettings: null,
    timestamp: 0,
    isPending: false,
    unreadCount: 0,
    channel: { id, type },
  } as unknown as db.Chat;
}

const soloGroup = groupChat('~ten/solo', [ME, BOT]);
const sharedGroup = groupChat('~ten/shared', [ME, BOT, '~zod']);
const dm = channelChat('~zod', 'dm');
const groupDm = channelChat('0v4.club', 'groupDm');
const pinnedGroupChannel = channelChat('chat/~zod/general', 'chat');

const all = [soloGroup, sharedGroup, dm, groupDm, pinnedGroupChannel];

describe('chatMatchesListFilter', () => {
  it('keeps everything under all', () => {
    expect(filterChatsByListFilter(all, 'all', ids)).toEqual(all);
  });

  it('reads a group of just the owner and their bot as just me', () => {
    expect(chatMatchesListFilter(soloGroup, 'just-me', ids)).toBe(true);
    expect(chatMatchesListFilter(soloGroup, 'with-others', ids)).toBe(false);
  });

  it('reads a group holding anyone else as with others', () => {
    expect(chatMatchesListFilter(sharedGroup, 'with-others', ids)).toBe(true);
    expect(chatMatchesListFilter(sharedGroup, 'just-me', ids)).toBe(false);
  });

  it('counts members the list query never loaded', () => {
    // getChats caps members at 4 for avatars, so the loaded list can look
    // solo while the group is not.
    const truncated = groupChat('~ten/big', [ME, BOT], 9);
    expect(chatMatchesListFilter(truncated, 'just-me', ids)).toBe(false);
    expect(chatMatchesListFilter(truncated, 'with-others', ids)).toBe(true);
  });

  it('treats a group with no member count as what it loaded', () => {
    const unknown = groupChat('~ten/unknown', [ME, BOT]);
    (unknown as { group: { memberCount: number | null } }).group.memberCount =
      null;
    expect(chatMatchesListFilter(unknown, 'just-me', ids)).toBe(true);
  });

  it('puts both kinds of direct message under messages', () => {
    expect(filterChatsByListFilter(all, 'messages', ids)).toEqual([
      dm,
      groupDm,
    ]);
  });

  it('keeps direct messages out of the group filters', () => {
    for (const filter of ['just-me', 'with-others'] as ChatListFilter[]) {
      expect(chatMatchesListFilter(dm, filter, ids)).toBe(false);
      expect(chatMatchesListFilter(groupDm, filter, ids)).toBe(false);
    }
  });

  it('partitions the list, so nothing falls out', () => {
    // A pinned group channel carries no membership, and still has to land
    // somewhere — with-others is the catch-all that makes the three narrow
    // filters add back up to the whole list.
    const partitioned = (['just-me', 'with-others', 'messages'] as const)
      .flatMap((filter) => filterChatsByListFilter(all, filter, ids))
      .map((chat) => chat.id)
      .sort();
    expect(partitioned).toEqual(all.map((chat) => chat.id).sort());
    expect(chatMatchesListFilter(pinnedGroupChannel, 'with-others', ids)).toBe(
      true
    );
  });
});
