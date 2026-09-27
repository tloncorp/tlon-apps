import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import { getDrawerChannelIcon, getDrawerChatLeading } from './drawerRowIcons';

function channel(
  type: db.Channel['type'],
  extra: Partial<db.Channel> = {}
): db.Channel {
  return { id: `channel-${type}`, type, ...extra } as db.Channel;
}

function channelChat(channel: db.Channel): db.Chat {
  return {
    id: channel.id,
    timestamp: 0,
    pin: null,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'channel',
    channel,
  };
}

function groupChat(group: Partial<db.Group> = {}): db.Chat {
  return {
    id: 'a-group',
    timestamp: 0,
    pin: null,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'group',
    group: { id: 'a-group', ...group } as db.Group,
  };
}

describe('getDrawerChatLeading', () => {
  it('marks a workspace with no icon with a hash', () => {
    expect(getDrawerChatLeading(groupChat(), false)).toEqual({
      kind: 'glyph',
      icon: 'Channel',
    });
    expect(getDrawerChatLeading(groupChat({ iconImage: null }), false)).toEqual(
      { kind: 'glyph', icon: 'Channel' }
    );
  });

  it('shows a workspace’s own icon, with the hash to fall back on', () => {
    expect(
      getDrawerChatLeading(
        groupChat({ iconImage: 'https://example.com/icon.png' }),
        false
      )
    ).toEqual({
      kind: 'image',
      imageUrl: 'https://example.com/icon.png',
      fallback: 'Channel',
    });
  });

  it('shows the person a direct message is with', () => {
    expect(
      getDrawerChatLeading(
        channelChat(
          channel('dm', {
            id: '~solfer-magfed',
            members: [
              {
                contactId: '~solfer-magfed',
                chatId: '~solfer-magfed',
                membershipType: 'channel',
              },
            ],
          })
        ),
        false
      )
    ).toEqual({ kind: 'contact', contactId: '~solfer-magfed' });
  });

  it('falls back to the channel id, which is the correspondent’s', () => {
    expect(
      getDrawerChatLeading(
        channelChat(channel('dm', { id: '~solfer-magfed' })),
        false
      )
    ).toEqual({ kind: 'contact', contactId: '~solfer-magfed' });
  });

  it('keeps the several-people glyph for a group DM', () => {
    expect(
      getDrawerChatLeading(channelChat(channel('groupDm')), false)
    ).toEqual({ kind: 'glyph', icon: 'ChannelMultiDM' });
  });

  it('gives a channel pinned to the top level its own kind of glyph', () => {
    expect(getDrawerChatLeading(channelChat(channel('chat')), false)).toEqual({
      kind: 'glyph',
      icon: 'ChannelTalk',
    });
  });

  it('leads every row of the pinned section with a pin', () => {
    const chats = [
      groupChat({ iconImage: 'https://example.com/icon.png' }),
      groupChat(),
      channelChat(channel('dm', { id: '~solfer-magfed' })),
      channelChat(channel('groupDm')),
      channelChat(channel('chat')),
    ];

    for (const chat of chats) {
      expect(getDrawerChatLeading(chat, true)).toEqual({
        kind: 'glyph',
        icon: 'Pin',
      });
    }
  });
});

describe('getDrawerChannelIcon', () => {
  it('gives each kind of channel the glyph the app already uses for it', () => {
    expect(getDrawerChannelIcon(channel('chat'))).toBe('ChannelTalk');
    expect(getDrawerChannelIcon(channel('gallery'))).toBe('ChannelGalleries');
    expect(getDrawerChannelIcon(channel('notes'))).toBe('ChannelNotebooks');
    expect(getDrawerChannelIcon(channel('notebook'))).toBe('Bulletin');
  });

  it('marks a conversation with people with a figure, one or several', () => {
    expect(getDrawerChannelIcon(channel('dm'))).toBe('ChannelDM');
    expect(getDrawerChannelIcon(channel('groupDm'))).toBe('ChannelMultiDM');
  });
});
