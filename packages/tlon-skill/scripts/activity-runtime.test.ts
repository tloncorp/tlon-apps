import { PokeAckTimeoutError, ReapError } from '@tloncorp/api/http-api';
import { afterEach, describe, expect, it } from 'bun:test';

import {
  createActivityDeps,
  formatActivityTime,
  formatEvent,
} from './activity-runtime';
import type { MarkReadTarget } from './commands/activity';
import {
  mockedActivityRead,
  mockedGetChannelPosts,
  mockedGetGroups,
  mockedPoke,
  mockedScry,
  mockedVolume,
} from './tloncorp-api-mock';

afterEach(() => {
  mockedVolume.adjustVolumeSetting = async () => undefined;
  mockedVolume.getVolumeSettings = async () => ({});
  mockedVolume.supportsReactions = false;
  mockedVolume.supportsNotes = false;
  mockedScry.impl = async () => undefined;
  mockedPoke.impl = async () => undefined;
  mockedActivityRead.readChannel = async () => undefined;
  mockedActivityRead.getGroupAndChannelUnreads = async () => ({
    baseUnread: null,
    groupUnreads: [],
    channelUnreads: [],
    threadActivity: [],
  });
  mockedGetGroups.impl = async () => [];
  mockedGetChannelPosts.impl = async () => ({
    posts: [],
    older: null,
    totalPosts: 0,
  });
});

describe('activity runtime formatting', () => {
  const now = Date.parse('2026-09-30T15:00:00Z');

  it('formats unix-ms event timestamps as UTC with a relative age', () => {
    expect(formatActivityTime(now - 20 * 1000, now)).toBe(
      '2026-09-30T14:59:40Z (just now)'
    );
    expect(formatActivityTime(now - 5 * 60 * 1000, now)).toBe(
      '2026-09-30T14:55:00Z (5m ago)'
    );
    expect(formatActivityTime(now - 3 * 60 * 60 * 1000, now)).toBe(
      '2026-09-30T12:00:00Z (3h ago)'
    );
    expect(formatActivityTime(now - 9 * 24 * 60 * 60 * 1000, now)).toBe(
      '2026-09-21T15:00:00Z (9d ago)'
    );
  });

  it('prints a real time for events, not unknown date', () => {
    const formatted = formatEvent(
      {
        id: 'e1',
        bucketId: 'mentions',
        sourceId: 's1',
        type: 'post',
        timestamp: now - 2 * 60 * 60 * 1000,
        authorId: '~zod',
        channelId: 'chat/~zod/test',
      },
      now
    );

    expect(formatted).toContain('Time: 2026-09-30T13:00:00Z (2h ago)');
    expect(formatted).not.toContain('unknown');
  });
});

describe('activity runtime volume endpoints', () => {
  it('enables the current activity mark for the volume poke', async () => {
    const seen: Array<[boolean, boolean]> = [];
    mockedVolume.adjustVolumeSetting = async () => {
      seen.push([mockedVolume.supportsReactions, mockedVolume.supportsNotes]);
    };

    await createActivityDeps().volumeApi.adjustVolumeSetting(
      { group: '~zod/book-club' },
      null
    );

    expect(seen).toEqual([[true, true]]);
  });

  it('enables the current settings path for the read-back', async () => {
    const seen: Array<[boolean, boolean]> = [];
    mockedVolume.getVolumeSettings = async () => {
      seen.push([mockedVolume.supportsReactions, mockedVolume.supportsNotes]);
      return {};
    };

    await createActivityDeps().volumeApi.getVolumeSettings();

    expect(seen).toEqual([[true, true]]);
  });

  it('leaves the flags alone for activity reads', async () => {
    await createActivityDeps().activityApi.getInitialActivity();

    expect(mockedVolume.supportsReactions).toBe(false);
    expect(mockedVolume.supportsNotes).toBe(false);
  });

  it('forwards the source and map to the api', async () => {
    const received: unknown[] = [];
    mockedVolume.adjustVolumeSetting = async (...args: unknown[]) => {
      received.push(args);
    };
    const map = { post: { unreads: true, notify: false } };

    await createActivityDeps().volumeApi.adjustVolumeSetting(
      { dm: { ship: '~ten' } },
      map
    );

    expect(received).toEqual([[{ dm: { ship: '~ten' } }, map]]);
  });
});

describe('activity runtime poke classification', () => {
  const adjust = () =>
    createActivityDeps().volumeApi.adjustVolumeSetting(
      { group: '~zod/book-club' },
      null
    );

  it('treats a resolved poke as acked', async () => {
    expect(await adjust()).toEqual({ kind: 'acked' });
  });

  it("treats eyre's non-Error rejection as a definitive nack", async () => {
    mockedVolume.adjustVolumeSetting = async () => {
      throw 'bail: %activity crashed';
    };

    expect(await adjust()).toEqual({
      kind: 'nacked',
      message: 'bail: %activity crashed',
    });
  });

  it('treats a reaped channel or an ack timeout as ambiguous', async () => {
    mockedVolume.adjustVolumeSetting = async () => {
      throw new ReapError('Channel was reaped');
    };
    expect(await adjust()).toEqual({
      kind: 'ambiguous',
      message: 'Channel was reaped',
    });

    const timeout = new PokeAckTimeoutError(30000);
    mockedVolume.adjustVolumeSetting = async () => {
      throw timeout;
    };
    expect(await adjust()).toEqual({
      kind: 'ambiguous',
      message: timeout.message,
    });
  });
});

describe('activity runtime target lookups', () => {
  it("reads a channel's group from perms.group, not the nest host", async () => {
    mockedScry.impl = async () => ({
      'chat/~nec/general': {
        perms: { group: '~zod/book-club', writers: [] },
        order: [],
        view: 'list',
        sort: 'time',
        pending: { posts: {}, replies: {} },
        meta: null,
      },
    });

    expect(
      await createActivityDeps().getChannelState('chat/~nec/general')
    ).toEqual({ joined: true, groupId: '~zod/book-club', order: [] });
  });

  it('finds the root post author and ignores replies and other ids', async () => {
    const received: unknown[] = [];
    mockedGetChannelPosts.impl = async (...args: unknown[]) => {
      received.push(args[0]);
      return {
        posts: [{ id: '170.141', authorId: '~ten', isDeleted: false }],
        older: null,
        totalPosts: 1,
      };
    };
    const deps = createActivityDeps();

    expect(await deps.findRootPost('chat/~nec/general', '170.141')).toEqual({
      id: '170.141',
      authorId: '~ten',
      isDeleted: false,
    });
    expect(received).toEqual([
      {
        channelId: 'chat/~nec/general',
        cursor: '170.141',
        mode: 'around',
        count: 1,
        includeReplies: false,
      },
    ]);

    mockedGetChannelPosts.impl = async () => ({
      posts: [
        {
          id: '170.141',
          authorId: '~ten',
          parentId: '170.100',
          isDeleted: false,
        },
        { id: '170.142', authorId: '~ten', isDeleted: false },
      ],
      older: null,
      totalPosts: 2,
    });
    expect(await deps.findRootPost('chat/~nec/general', '170.141')).toBeNull();
  });

  it('checks group membership against the joined groups', async () => {
    mockedGetGroups.impl = async () => [{ id: '~zod/book-club' }];
    const deps = createActivityDeps();

    expect(await deps.isJoinedGroup('~zod/book-club')).toBe(true);
    expect(await deps.isJoinedGroup('~zod/other')).toBe(false);
  });
});

describe('activity runtime mark read', () => {
  const GROUP = '~zod/book-club';
  const readTargets: Array<{ target: MarkReadTarget; args: unknown }> = [
    {
      target: { kind: 'dm-ship', ship: '~ten' },
      args: { channelId: '~ten', channelType: 'dm', deep: true },
    },
    {
      target: { kind: 'dm-club', club: '0v1f.abcde' },
      args: { channelId: '0v1f.abcde', channelType: 'groupDm', deep: true },
    },
    {
      target: { kind: 'channel', nest: 'chat/~nec/general', groupId: GROUP },
      args: {
        channelId: 'chat/~nec/general',
        channelType: 'chat',
        groupId: GROUP,
        deep: true,
      },
    },
    {
      target: { kind: 'channel', nest: 'heap/~nec/pics', groupId: GROUP },
      args: {
        channelId: 'heap/~nec/pics',
        channelType: 'gallery',
        groupId: GROUP,
        deep: true,
      },
    },
  ];
  const deepRead = (source: unknown) => ({
    app: 'activity',
    mark: 'activity-action-2',
    json: {
      read: { source, action: { all: { time: null, deep: true } } },
    },
  });
  const pokeTargets: Array<{ target: MarkReadTarget; poke: unknown }> = [
    {
      target: { kind: 'group', flag: GROUP },
      poke: deepRead({ group: GROUP }),
    },
    { target: { kind: 'all' }, poke: deepRead({ base: null }) },
  ];

  for (const { target, args } of readTargets) {
    it(`reads a ${target.kind} through readChannel with the current endpoints`, async () => {
      const received: unknown[] = [];
      const seen: Array<[boolean, boolean]> = [];
      mockedActivityRead.readChannel = async (...callArgs: unknown[]) => {
        received.push(callArgs);
        seen.push([mockedVolume.supportsReactions, mockedVolume.supportsNotes]);
      };
      mockedPoke.impl = async () => {
        throw new Error('poke used for a channel read');
      };

      expect(await createActivityDeps().readApi.markRead(target)).toEqual({
        kind: 'acked',
      });
      expect(received).toEqual([[args]]);
      expect(seen).toEqual([[true, true]]);
    });
  }

  for (const { target, poke } of pokeTargets) {
    it(`sends one deep ${target.kind} read on the current mark`, async () => {
      const received: unknown[] = [];
      mockedPoke.impl = async (...callArgs: unknown[]) => {
        received.push(callArgs);
      };

      expect(await createActivityDeps().readApi.markRead(target)).toEqual({
        kind: 'acked',
      });
      expect(received).toEqual([[poke]]);
    });

    it(`does not retry a nacked ${target.kind} read`, async () => {
      let calls = 0;
      mockedPoke.impl = async () => {
        calls += 1;
        throw 'bail: %activity crashed';
      };

      expect(await createActivityDeps().readApi.markRead(target)).toEqual({
        kind: 'nacked',
        message: 'bail: %activity crashed',
      });
      expect(calls).toBe(1);
    });
  }

  it('treats a reaped channel or an ack timeout as ambiguous', async () => {
    const markGroup = () =>
      createActivityDeps().readApi.markRead({ kind: 'group', flag: GROUP });

    mockedPoke.impl = async () => {
      throw new ReapError('Channel was reaped');
    };
    expect(await markGroup()).toEqual({
      kind: 'ambiguous',
      message: 'Channel was reaped',
    });

    const timeout = new PokeAckTimeoutError(30000);
    mockedActivityRead.readChannel = async () => {
      throw timeout;
    };
    expect(
      await createActivityDeps().readApi.markRead({
        kind: 'dm-ship',
        ship: '~ten',
      })
    ).toEqual({ kind: 'ambiguous', message: timeout.message });
  });

  it('enables the current summary path for the read-back', async () => {
    const seen: Array<[boolean, boolean]> = [];
    mockedActivityRead.getGroupAndChannelUnreads = async () => {
      seen.push([mockedVolume.supportsReactions, mockedVolume.supportsNotes]);
      return {
        groupUnreads: [],
        channelUnreads: [],
        threadActivity: [],
      };
    };

    await createActivityDeps().readApi.getUnreads();

    expect(seen).toEqual([[true, true]]);
  });

  it('reports an unreadable summary as a command error', async () => {
    mockedActivityRead.getGroupAndChannelUnreads = async () => {
      throw new Error('scry 500');
    };

    await expect(
      createActivityDeps().readApi.getUnreads()
    ).rejects.toMatchObject({ name: 'CommandError', message: 'scry 500' });
  });
});
