import type * as db from '@tloncorp/shared/db';
import { describe, expect, it, vi } from 'vitest';

import { createChatSearchSource, searchChatDocs } from './useChatSearch';

// The real title helpers live beside the store's hooks, whose imports reach
// expo's native modules. The titles here are plain, so read them directly.
vi.mock('../ui/utils/channelUtils', () => ({
  getChatTitle: (chat: db.Chat) =>
    chat.type === 'channel' ? chat.channel.title : chat.group.title,
  getGroupTitle: (group: db.Group) => group.title,
}));

function group(id: string, title: string): db.Chat {
  return {
    id,
    timestamp: 0,
    pin: null,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'group',
    group: { id, title, currentUserIsMember: true } as db.Group,
  };
}

function channel(
  id: string,
  title: string,
  enclosing?: db.Chat,
  timestamp = 0
): db.Chat {
  return {
    id,
    timestamp,
    pin: null,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'channel',
    channel: {
      id,
      type: 'chat',
      title,
      groupId: enclosing?.id ?? null,
      group: enclosing?.type === 'group' ? enclosing.group : null,
    } as db.Channel,
  };
}

const tlon = group('~sampel-palnet/tlon', 'Tlon Local');
const design = group('~sampel-palnet/design', 'Design Club');
const tlonGeneral = channel('chat/~sampel-palnet/general', 'General', tlon, 2);
const designGeneral = channel('chat/~sampel-palnet/dgen', 'General', design, 1);
const chats = [tlon, design, tlonGeneral, designGeneral];

const inGroup = (chat: db.Chat) =>
  chat.type === 'channel' && chat.channel.groupId != null;

function search(query: string, searchesTitleOnly?: (chat: db.Chat) => boolean) {
  const source = createChatSearchSource(chats, false, '', searchesTitleOnly);
  return searchChatDocs(source.docs, source.fuse, query).map((c) => c.id);
}

describe('searchChatDocs, with chats found by their own title', () => {
  it('finds them by that title', () => {
    expect(search('general', inGroup)).toEqual([
      tlonGeneral.id,
      designGeneral.id,
    ]);
  });

  it('does not find them by their group’s title alone', () => {
    expect(search('tlon', inGroup)).toEqual([tlon.id]);
    expect(search('local tlon', inGroup)).toEqual([tlon.id]);
  });

  it('does not find them by their id', () => {
    expect(search('sampel', inGroup)).not.toContain(tlonGeneral.id);
    expect(search('chat', inGroup)).not.toContain(tlonGeneral.id);
  });

  it('narrows to one group when its title is typed alongside', () => {
    expect(search('tlon general', inGroup)).toEqual([tlonGeneral.id]);
    expect(search('general design', inGroup)).toEqual([designGeneral.id]);
  });

  it('leaves every other chat matched as before', () => {
    const everything = search('tlon');

    expect(everything).toContain(tlon.id);
    expect(everything).toContain(tlonGeneral.id);
  });
});
