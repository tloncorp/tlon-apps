import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  channelRecency,
  channelRowHasUnread,
  getDrawerRows,
  getUnfurlableChannels,
  toggleUnfurled,
  unfurls,
} from './drawerWorkspaceRows';

function channel(
  id: string,
  {
    lastPostAt = 0,
    updatedAt = 0,
    currentUserIsMember = true,
    count = 0,
    notify = false,
    volume,
  }: {
    lastPostAt?: number;
    updatedAt?: number;
    currentUserIsMember?: boolean | null;
    count?: number;
    notify?: boolean;
    volume?: db.VolumeSettings['level'];
  } = {}
): db.Channel {
  return {
    id,
    lastPostAt,
    currentUserIsMember,
    unread:
      updatedAt || count || notify
        ? ({ updatedAt, count, notify } as db.ChannelUnread)
        : null,
    volumeSettings: volume ? ({ level: volume } as db.VolumeSettings) : null,
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

describe('getUnfurlableChannels, on channels the user cannot read', () => {
  // `currentUserIsMember` is set from read permission, so a role-gated channel
  // of a group the user belongs to is in the chat list with the flag false.
  const gated = workspace('group', [
    channel('open', { lastPostAt: 20 }),
    channel('gated', { lastPostAt: 30, currentUserIsMember: false }),
  ]);

  it('leaves them out of what a workspace unfurls', () => {
    expect(getUnfurlableChannels(gated)).toBeNull();
    expect(unfurls(gated)).toBe(false);
  });

  it('does not let them make a one-channel workspace look like a many', () => {
    const rows = getDrawerRows([gated], 'group');

    expect(rows.map((row) => row.key)).toEqual(['group']);
  });

  it('keeps a workspace that has two the user can read', () => {
    const mixed = workspace('group', [
      channel('open', { lastPostAt: 20 }),
      channel('also-open', { lastPostAt: 10 }),
      channel('gated', { lastPostAt: 30, currentUserIsMember: false }),
    ]);

    expect(getUnfurlableChannels(mixed)?.map((c) => c.id)).toEqual([
      'open',
      'also-open',
    ]);
  });

  // The flag is unset until the group syncs; `getGroup` counts only a true, so
  // counting anything else here would disagree with the screen behind.
  it('treats an unset flag as not readable, as the group query does', () => {
    const unsynced = workspace('group', [
      channel('one', { lastPostAt: 2, currentUserIsMember: null }),
      channel('two', { lastPostAt: 1, currentUserIsMember: null }),
    ]);

    expect(unfurls(unsynced)).toBe(false);
  });
});

describe('channelRowHasUnread', () => {
  it('lights for a count, and for a notification without one', () => {
    expect(channelRowHasUnread(channel('a', { count: 3 }), false)).toBe(true);
    expect(channelRowHasUnread(channel('b', { notify: true }), false)).toBe(
      true
    );
  });

  it('stays dark with nothing unread', () => {
    expect(channelRowHasUnread(channel('c'), false)).toBe(false);
  });

  it('stays dark for a hushed channel', () => {
    expect(
      channelRowHasUnread(channel('d', { count: 3, volume: 'hush' }), false)
    ).toBe(false);
  });

  // `soft` mutes a group but not a channel, which is `isMuted`'s own split.
  it('still lights for a channel set to soft', () => {
    expect(
      channelRowHasUnread(channel('e', { count: 3, volume: 'soft' }), false)
    ).toBe(true);
  });

  it('stays dark for a channel of a muted workspace that has no setting', () => {
    expect(channelRowHasUnread(channel('f', { count: 3 }), true)).toBe(false);
    expect(channelRowHasUnread(channel('g', { notify: true }), true)).toBe(
      false
    );
  });

  // A channel's own setting replaces what encloses it rather than being read
  // alongside it, so a channel turned back up inside a muted workspace is one
  // the user still hears.
  it('lights for a channel turned back up inside a muted workspace', () => {
    expect(
      channelRowHasUnread(channel('h', { count: 3, volume: 'loud' }), true)
    ).toBe(true);
    expect(
      channelRowHasUnread(channel('i', { count: 3, volume: 'medium' }), true)
    ).toBe(true);
  });

  it('stays dark for a channel hushed inside an unmuted workspace', () => {
    expect(
      channelRowHasUnread(channel('j', { count: 3, volume: 'hush' }), false)
    ).toBe(false);
  });
});

describe('getDrawerRows', () => {
  const many = workspace('group', [
    channel('newest', { lastPostAt: 30 }),
    channel('oldest', { lastPostAt: 10 }),
  ]);

  it('lists chats alone while nothing is unfurled', () => {
    const rows = getDrawerRows([many, dm('a-dm')], null);

    expect(rows.map((row) => row.key)).toEqual(['group', 'a-dm']);
    expect(rows[0]).toMatchObject({ unfurls: true, unfurled: false });
    expect(rows[1]).toMatchObject({ unfurls: false, unfurled: false });
  });

  it('lays an unfurled workspace’s channels directly beneath it', () => {
    const rows = getDrawerRows([many, dm('a-dm')], 'group');

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
    const rows = getDrawerRows([many, pinnedOut], 'group');

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
      'group'
    );

    expect(first).toMatchObject({ kind: 'channel', groupMuted: true });
  });

  it('ignores an unfurled id belonging to a row that does not unfurl', () => {
    const rows = getDrawerRows([dm('a-dm')], 'a-dm');

    expect(rows.map((row) => row.key)).toEqual(['a-dm']);
  });
});

describe('toggleUnfurled', () => {
  it('opens a closed workspace and closes an open one', () => {
    expect(toggleUnfurled(null, 'group')).toBe('group');
    expect(toggleUnfurled('group', 'group')).toBeNull();
  });

  it('closes whichever was open to open another', () => {
    expect(toggleUnfurled('a', 'b')).toBe('b');
  });
});

describe('getDrawerRows, with one workspace open at a time', () => {
  const first = workspace('first', [
    channel('first-a', { lastPostAt: 2 }),
    channel('first-b', { lastPostAt: 1 }),
  ]);
  const second = workspace('second', [
    channel('second-a', { lastPostAt: 2 }),
    channel('second-b', { lastPostAt: 1 }),
  ]);

  it('lays out the channels of the open one and no other', () => {
    expect(getDrawerRows([first, second], 'second').map((r) => r.key)).toEqual([
      'first',
      'second',
      'second:second-a',
      'second:second-b',
    ]);
  });

  it('closes the one that was open when another is pressed', () => {
    const open = toggleUnfurled('first', 'second');

    expect(getDrawerRows([first, second], open).map((r) => r.key)).toEqual([
      'first',
      'second',
      'second:second-a',
      'second:second-b',
    ]);
  });
});
