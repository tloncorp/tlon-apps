import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  channelRecency,
  getDrawerRows,
  getUnfurlableChannels,
  toggleUnfurled,
} from './drawerWorkspaceRows';

function channel(
  id: string,
  { lastPostAt = 0, updatedAt = 0 }: { lastPostAt?: number; updatedAt?: number }
): db.Channel {
  return {
    id,
    lastPostAt,
    unread: updatedAt ? ({ updatedAt } as db.ChannelUnread) : null,
  } as db.Channel;
}

function workspace(
  id: string,
  channels: db.Channel[],
  {
    isPending = false,
    volume = null,
  }: { isPending?: boolean; volume?: db.VolumeSettings | null } = {}
): db.Chat {
  return {
    id,
    timestamp: 0,
    pin: null,
    volumeSettings: volume,
    isPending,
    unreadCount: 0,
    type: 'group',
    group: { id, channels } as db.Group,
  };
}

function dm(id: string): db.Chat {
  return {
    id,
    timestamp: 0,
    pin: null,
    volumeSettings: null,
    isPending: false,
    unreadCount: 0,
    type: 'channel',
    channel: { id, type: 'dm' } as db.Channel,
  };
}

describe('channelRecency', () => {
  it('takes whichever of the last post and the activity summary is newer', () => {
    expect(
      channelRecency(channel('a', { lastPostAt: 10, updatedAt: 30 }))
    ).toBe(30);
    expect(
      channelRecency(channel('b', { lastPostAt: 40, updatedAt: 20 }))
    ).toBe(40);
  });

  it('is zero for a channel that has seen nothing', () => {
    expect(channelRecency(channel('c', {}))).toBe(0);
  });
});

describe('getUnfurlableChannels', () => {
  it('orders a workspace’s channels by recency', () => {
    const channels = getUnfurlableChannels(
      workspace('group', [
        channel('middle', { lastPostAt: 20 }),
        channel('newest', { lastPostAt: 10, updatedAt: 30 }),
        channel('oldest', { lastPostAt: 5 }),
      ])
    );

    expect(channels?.map((c) => c.id)).toEqual(['newest', 'middle', 'oldest']);
  });

  it('leaves the given order untouched', () => {
    const given = [
      channel('older', { lastPostAt: 1 }),
      channel('newer', { lastPostAt: 2 }),
    ];
    getUnfurlableChannels(workspace('group', given));

    expect(given.map((c) => c.id)).toEqual(['older', 'newer']);
  });

  it('does not unfurl a direct message', () => {
    expect(getUnfurlableChannels(dm('a-dm'))).toBeNull();
  });

  it('does not unfurl an invite the user has not accepted', () => {
    const invited = workspace(
      'invite',
      [channel('one', { lastPostAt: 2 }), channel('two', { lastPostAt: 1 })],
      { isPending: true }
    );

    expect(getUnfurlableChannels(invited)).toBeNull();
  });

  // Opening it already opens that channel, so unfurling would put the one
  // conversation on two rows.
  it('does not unfurl a workspace holding one channel, or none', () => {
    expect(
      getUnfurlableChannels(workspace('solo', [channel('only', {})]))
    ).toBeNull();
    expect(getUnfurlableChannels(workspace('empty', []))).toBeNull();
  });
});

describe('getDrawerRows', () => {
  const many = workspace('group', [
    channel('newest', { lastPostAt: 30 }),
    channel('oldest', { lastPostAt: 10 }),
  ]);

  it('lists chats alone while nothing is unfurled', () => {
    const rows = getDrawerRows([many, dm('a-dm')], new Set());

    expect(rows.map((row) => row.key)).toEqual(['group', 'a-dm']);
    expect(rows[0]).toMatchObject({ unfurls: true, unfurled: false });
    expect(rows[1]).toMatchObject({ unfurls: false, unfurled: false });
  });

  it('lays an unfurled workspace’s channels directly beneath it', () => {
    const rows = getDrawerRows([many, dm('a-dm')], new Set(['group']));

    expect(rows.map((row) => row.key)).toEqual([
      'group',
      'group:newest',
      'group:oldest',
      'a-dm',
    ]);
    expect(rows[0]).toMatchObject({ unfurled: true });
    expect(rows[1]).toMatchObject({
      kind: 'channel',
      groupId: 'group',
      last: false,
    });
    expect(rows[2]).toMatchObject({ kind: 'channel', last: true });
  });

  // The same channel can be both a row of its workspace and a top-level row of
  // its own, and the virtualiser has to be able to tell the two apart.
  it('qualifies a channel’s key with its workspace', () => {
    const pinnedOut: db.Chat = {
      id: 'newest',
      timestamp: 0,
      pin: null,
      volumeSettings: null,
      isPending: false,
      unreadCount: 0,
      type: 'channel',
      channel: { id: 'newest', type: 'chat' } as db.Channel,
    };
    const rows = getDrawerRows([many, pinnedOut], new Set(['group']));

    expect(rows.map((row) => row.key)).toEqual([
      'group',
      'group:newest',
      'group:oldest',
      'newest',
    ]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it('carries a muted workspace’s silence down to its channels', () => {
    const [, first] = getDrawerRows(
      [
        workspace(
          'group',
          many.type === 'group' ? (many.group.channels ?? []) : [],
          {
            volume: { level: 'soft' } as db.VolumeSettings,
          }
        ),
      ],
      new Set(['group'])
    );

    expect(first).toMatchObject({ kind: 'channel', groupMuted: true });
  });

  it('ignores an unfurled id belonging to a row that does not unfurl', () => {
    const rows = getDrawerRows([dm('a-dm')], new Set(['a-dm']));

    expect(rows.map((row) => row.key)).toEqual(['a-dm']);
  });
});

describe('toggleUnfurled', () => {
  it('opens a closed workspace and closes an open one', () => {
    const opened = toggleUnfurled(new Set(), 'group');
    expect([...opened]).toEqual(['group']);
    expect([...toggleUnfurled(opened, 'group')]).toEqual([]);
  });

  it('leaves the others open', () => {
    const both = toggleUnfurled(toggleUnfurled(new Set(), 'a'), 'b');

    expect([...toggleUnfurled(both, 'a')]).toEqual(['b']);
  });

  it('does not mutate the set it was given', () => {
    const before = new Set(['a']);
    toggleUnfurled(before, 'b');

    expect([...before]).toEqual(['a']);
  });
});
