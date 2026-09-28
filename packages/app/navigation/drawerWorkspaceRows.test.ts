import type * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  channelRecency,
  channelRowUnread,
  chatRowHasUnread,
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

const hush = { level: 'hush' } as db.VolumeSettings;

describe('chatRowHasUnread', () => {
  it('lights an unheard chat, and a notified one with no count', () => {
    expect(chatRowHasUnread({ ...dm('a'), unreadCount: 2 })).toBe(true);
    const notifiedDm: db.Chat = {
      id: 'a',
      timestamp: 0,
      pin: null,
      volumeSettings: null,
      isPending: false,
      unreadCount: 0,
      type: 'channel',
      channel: { id: 'a', type: 'dm', unread: { notify: true } } as db.Channel,
    };
    expect(chatRowHasUnread(notifiedDm)).toBe(true);
    expect(chatRowHasUnread(dm('a'))).toBe(false);
  });

  it('keeps a muted chat dark', () => {
    expect(
      chatRowHasUnread({ ...dm('a'), unreadCount: 9, volumeSettings: hush })
    ).toBe(false);
  });

  it('lights a muted workspace for a channel turned back up', () => {
    const muted = workspace(
      'w',
      [
        channel('quiet', { count: 4 }),
        channel('loud', { count: 1, volume: 'loud' }),
      ],
      { volume: hush }
    );

    expect(chatRowHasUnread({ ...muted, unreadCount: 5 })).toBe(true);
  });

  // Folded shut, the workspace's row is the only place the panel can say so.
  it('lights a muted workspace of one channel turned back up', () => {
    const muted = workspace(
      'w',
      [channel('only', { count: 1, volume: 'loud' })],
      { volume: hush }
    );

    expect(chatRowHasUnread({ ...muted, unreadCount: 1 })).toBe(true);
  });

  it('stays dark when a muted workspace has no channel of its own to speak', () => {
    const muted = workspace(
      'w',
      [channel('a', { count: 4 }), channel('b', { count: 2 })],
      { volume: hush }
    );

    expect(chatRowHasUnread({ ...muted, unreadCount: 6 })).toBe(false);
  });

  it('stays dark for a channel the user cannot read, and for one muted itself', () => {
    const unreadable = workspace(
      'w',
      [
        channel('gated', {
          count: 3,
          volume: 'loud',
          currentUserIsMember: false,
        }),
      ],
      { volume: hush }
    );
    const alsoMuted = workspace(
      'w',
      [channel('quieter', { count: 3, volume: 'hush' })],
      { volume: hush }
    );

    expect(chatRowHasUnread({ ...unreadable, unreadCount: 3 })).toBe(false);
    expect(chatRowHasUnread({ ...alsoMuted, unreadCount: 3 })).toBe(false);
  });

  it("stays dark for an invite, whose channels are not the user's to hear yet", () => {
    const invite = workspace(
      'w',
      [channel('only', { count: 1, volume: 'loud' })],
      { isPending: true, volume: hush }
    );

    expect(chatRowHasUnread({ ...invite, unreadCount: 1 })).toBe(false);
  });
});

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

  it('unfurls a workspace of one channel like any other', () => {
    const solo = workspace('solo', [channel('only', {})]);

    expect(unfurls(solo)).toBe(true);
    expect(getUnfurlableChannels(solo)?.map((c) => c.id)).toEqual(['only']);
    expect(getDrawerRows([solo], 'solo').map((row) => row.key)).toEqual([
      'solo',
      'solo:only',
    ]);
  });

  // There would be nothing under it, so it opens the way the workspace list
  // opens it instead.
  it('does not unfurl a workspace with no channels', () => {
    expect(unfurls(workspace('empty', []))).toBe(false);
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
    expect(getUnfurlableChannels(gated)?.map((c) => c.id)).toEqual(['open']);
    expect(getDrawerRows([gated], 'group').map((row) => row.key)).toEqual([
      'group',
      'group:open',
    ]);
  });

  it('does not unfurl a workspace whose every channel is gated', () => {
    const allGated = workspace('group', [
      channel('gated', { lastPostAt: 30, currentUserIsMember: false }),
    ]);

    expect(unfurls(allGated)).toBe(false);
    expect(getDrawerRows([allGated], 'group').map((row) => row.key)).toEqual([
      'group',
    ]);
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

describe('channelRowUnread', () => {
  it('takes the accent for a notification the user hears', () => {
    expect(channelRowUnread(channel('a', { notify: true }), false)).toBe(
      'notified'
    );
    expect(
      channelRowUnread(channel('b', { count: 3, notify: true }), false)
    ).toBe('notified');
  });

  it('is quiet for an unread that does not alert', () => {
    expect(channelRowUnread(channel('c', { count: 3 }), false)).toBe('quiet');
  });

  it('says nothing with nothing unread', () => {
    expect(channelRowUnread(channel('d'), false)).toBe('none');
    expect(channelRowUnread(channel('e', { volume: 'hush' }), true)).toBe(
      'none'
    );
  });

  // Opened to be looked inside, a muted channel still says what it holds —
  // in grey, whatever the unread would have done had it been heard.
  it('is quiet for a hushed channel, notified or not', () => {
    expect(
      channelRowUnread(channel('f', { count: 3, volume: 'hush' }), false)
    ).toBe('quiet');
    expect(
      channelRowUnread(channel('g', { notify: true, volume: 'hush' }), false)
    ).toBe('quiet');
  });

  it('is quiet for a channel of a muted workspace that has no setting', () => {
    expect(channelRowUnread(channel('h', { count: 3 }), true)).toBe('quiet');
    expect(channelRowUnread(channel('i', { notify: true }), true)).toBe(
      'quiet'
    );
  });

  // `soft` mutes a group but not a channel, which is `isMuted`'s own split.
  it('still takes the accent for a channel set to soft', () => {
    expect(
      channelRowUnread(channel('j', { notify: true, volume: 'soft' }), false)
    ).toBe('notified');
  });

  // A channel's own setting replaces what encloses it rather than being read
  // alongside it, so a channel turned back up inside a muted workspace is one
  // the user still hears.
  it('takes the accent for a channel turned back up inside a muted workspace', () => {
    expect(
      channelRowUnread(channel('k', { notify: true, volume: 'loud' }), true)
    ).toBe('notified');
    expect(
      channelRowUnread(channel('l', { notify: true, volume: 'medium' }), true)
    ).toBe('notified');
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

describe('getDrawerRows, with channels the user has not joined', () => {
  const unjoined = (id: string, groupId: string, lastPostAt = 0) =>
    ({
      ...channel(id, { lastPostAt, currentUserIsMember: false }),
      groupId,
    }) as db.Channel;
  const open = workspace('group', [
    channel('joined-new', { lastPostAt: 30 }),
    channel('joined-old', { lastPostAt: 10 }),
  ]);

  it('lists them after the joined channels, newest first, ending the block', () => {
    const rows = getDrawerRows([open], 'group', false, [
      unjoined('left-old', 'group', 5),
      unjoined('left-new', 'group', 20),
    ]);

    expect(rows.map((row) => row.key)).toEqual([
      'group',
      'group:joined-new',
      'group:joined-old',
      'group:left-new',
      'group:left-old',
    ]);
    expect(
      rows.slice(1).map((row) => row.kind === 'channel' && row.joined)
    ).toEqual([true, true, false, false]);
    expect(
      rows.slice(1).map((row) => row.kind === 'channel' && row.last)
    ).toEqual([false, false, false, true]);
  });

  it('skips channels of other workspaces and ones already listed as joined', () => {
    const rows = getDrawerRows([open], 'group', false, [
      unjoined('elsewhere', 'other-group'),
      unjoined('joined-new', 'group'),
    ]);

    expect(rows.map((row) => row.key)).toEqual([
      'group',
      'group:joined-new',
      'group:joined-old',
    ]);
  });

  it('stays open on what it offers once its last joined channel is left', () => {
    const emptied = workspace('group', [
      channel('left', { currentUserIsMember: false }),
    ]);
    const rows = getDrawerRows([emptied], 'group', false, [
      unjoined('left', 'group'),
    ]);

    expect(rows.map((row) => row.key)).toEqual(['group', 'group:left']);
    expect(rows[0]).toMatchObject({ unfurls: true, unfurled: true });
    expect(rows[1]).toMatchObject({ joined: false, last: true });
  });

  it('shows none while the workspace is folded', () => {
    const rows = getDrawerRows([open], null, false, [
      unjoined('left', 'group'),
    ]);

    expect(rows.map((row) => row.key)).toEqual(['group']);
  });
});
