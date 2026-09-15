import type * as db from '@tloncorp/shared/db';
import { describe, expect, test } from 'vitest';

import {
  DIRECT_MESSAGES_SECTION_TITLE,
  GROUPS_SECTION_TITLE,
  PINNED_SECTION_TITLE,
  buildChatSections,
} from './chatSections';

function makeGroupChat(id: string): db.Chat {
  return {
    id,
    type: 'group',
    pin: null,
    volumeSettings: null,
    timestamp: 100,
    isPending: false,
    unreadCount: 0,
    group: { id, title: id } as db.Group,
  };
}

function makeChannelChat(id: string, channelType: string): db.Chat {
  return {
    id,
    type: 'channel',
    pin: null,
    volumeSettings: null,
    timestamp: 100,
    isPending: false,
    unreadCount: 0,
    channel: { id, type: channelType } as db.Channel,
  } as db.Chat;
}

function sectionsOf(
  data: ReturnType<typeof buildChatSections>
): [string, string[]][] {
  return data.map((section) => [
    section.title,
    section.data.map((chat) => chat.id),
  ]);
}

const combined = { combinedSectionTitle: 'All', separateDirectMessages: false };
const split = { combinedSectionTitle: 'All', separateDirectMessages: true };

describe('buildChatSections', () => {
  test('splits unpinned chats into direct messages and groups', () => {
    const sections = buildChatSections({
      pinnedChats: [],
      unpinnedChats: [
        makeGroupChat('~zod/group'),
        makeChannelChat('~zod/dm', 'dm'),
        makeChannelChat('~zod/group-dm', 'groupDm'),
      ],
      ...split,
    });

    expect(sectionsOf(sections)).toEqual([
      [DIRECT_MESSAGES_SECTION_TITLE, ['~zod/dm', '~zod/group-dm']],
      [GROUPS_SECTION_TITLE, ['~zod/group']],
    ]);
  });

  test('keeps pinned chats in their own leading section', () => {
    const sections = buildChatSections({
      pinnedChats: [makeChannelChat('~zod/pinned', 'chat')],
      unpinnedChats: [makeChannelChat('~zod/dm', 'dm')],
      ...split,
    });

    expect(sectionsOf(sections)).toEqual([
      [PINNED_SECTION_TITLE, ['~zod/pinned']],
      [DIRECT_MESSAGES_SECTION_TITLE, ['~zod/dm']],
    ]);
  });

  test('drops a section rather than showing an empty heading', () => {
    const sections = buildChatSections({
      pinnedChats: [],
      unpinnedChats: [makeGroupChat('~zod/group')],
      ...split,
    });

    expect(sectionsOf(sections)).toEqual([
      [GROUPS_SECTION_TITLE, ['~zod/group']],
    ]);
  });

  test('sorts a non-DM channel with the groups so no chat is dropped', () => {
    // A group chat channel is only in this list when pinned, but if one ever
    // reaches the unpinned set it must still appear somewhere.
    const sections = buildChatSections({
      pinnedChats: [],
      unpinnedChats: [makeChannelChat('~zod/channel', 'chat')],
      ...split,
    });

    expect(sectionsOf(sections)).toEqual([
      [GROUPS_SECTION_TITLE, ['~zod/channel']],
    ]);
  });

  test('leaves the combined section alone when not separating', () => {
    const sections = buildChatSections({
      pinnedChats: [makeChannelChat('~zod/pinned', 'chat')],
      unpinnedChats: [
        makeGroupChat('~zod/group'),
        makeChannelChat('~zod/dm', 'dm'),
      ],
      ...combined,
    });

    expect(sectionsOf(sections)).toEqual([
      [PINNED_SECTION_TITLE, ['~zod/pinned']],
      ['All', ['~zod/group', '~zod/dm']],
    ]);
  });
});
