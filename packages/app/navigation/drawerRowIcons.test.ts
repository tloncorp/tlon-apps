import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import { getDrawerChannelIcon, getDrawerChatIcon } from './drawerRowIcons';

function channel(type: db.Channel['type']): db.Channel {
  return { id: `channel-${type}`, type } as db.Channel;
}

function channelChat(type: db.Channel['type']): db.Chat {
  return {
    id: `channel-${type}`,
    timestamp: 0,
    pin: null,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'channel',
    channel: channel(type),
  };
}

describe('getDrawerChatIcon', () => {
  it('marks a workspace with a hash', () => {
    const chat: db.Chat = {
      id: 'a-group',
      timestamp: 0,
      pin: null,
      volumeSettings: null,
      isPending: false,
      unreadCount: 0,
      type: 'group',
      group: { id: 'a-group' } as db.Group,
    };

    expect(getDrawerChatIcon(chat)).toBe('Channel');
  });

  it('marks a conversation with people with a figure, one or several', () => {
    expect(getDrawerChatIcon(channelChat('dm'))).toBe('ChannelDM');
    expect(getDrawerChatIcon(channelChat('groupDm'))).toBe('ChannelMultiDM');
  });

  it('gives a channel pinned to the top level its own kind of glyph', () => {
    expect(getDrawerChatIcon(channelChat('chat'))).toBe('ChannelTalk');
  });
});

describe('getDrawerChannelIcon', () => {
  it('gives each kind of channel the glyph the app already uses for it', () => {
    expect(getDrawerChannelIcon(channel('chat'))).toBe('ChannelTalk');
    expect(getDrawerChannelIcon(channel('gallery'))).toBe('ChannelGalleries');
    expect(getDrawerChannelIcon(channel('notes'))).toBe('ChannelNotebooks');
    expect(getDrawerChannelIcon(channel('notebook'))).toBe('Bulletin');
  });
});
