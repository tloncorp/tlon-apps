import { describe, expect, it } from 'bun:test';

import {
  ACTIVITY_HELP,
  type ActivityDeps,
  type ActivityEvent,
  type ActivityInit,
  run,
} from './activity';
import { commandError } from './command';

function makeDeps(
  options: {
    events?: ActivityEvent[];
    getInitialActivity?: ActivityDeps['activityApi']['getInitialActivity'];
    getGroupAndChannelUnreads?: ActivityDeps['activityApi']['getGroupAndChannelUnreads'];
    unreads?: ActivityInit;
  } = {}
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    getInitialActivity: 0,
    getGroupAndChannelUnreads: 0,
    eventFormatter: [] as string[],
  };

  const deps: ActivityDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
    },
    activityApi: {
      getInitialActivity:
        options.getInitialActivity ??
        (async () => {
          calls.getInitialActivity += 1;
          return { events: options.events ?? [] };
        }),
      getGroupAndChannelUnreads:
        options.getGroupAndChannelUnreads ??
        (async () => {
          calls.getGroupAndChannelUnreads += 1;
          if (options.unreads) return options.unreads;
          return {
            baseUnread: {
              id: 'base_unreads',
              updatedAt: 1,
              count: 1,
              notify: false,
              notifyCount: 1,
            },
            groupUnreads: [
              {
                groupId: '~zod/test',
                updatedAt: 1,
                count: 2,
                notify: false,
              },
            ],
            channelUnreads: [
              {
                channelId: 'chat/~zod/test',
                type: 'channel',
                updatedAt: 1,
                count: 3,
                notify: false,
                countWithoutThreads: 2,
              },
            ],
            threadActivity: [],
          };
        }),
    },
    format: {
      activityHeader: (bucket, count) => `HEADER:${bucket}:${count}`,
      noActivity: (bucket, unreadOnly) =>
        unreadOnly ? `NO_UNREAD_ACTIVITY:${bucket}` : `NO_ACTIVITY:${bucket}`,
      event: (event) => {
        calls.eventFormatter.push(event.id);
        return `EVENT:${event.id}`;
      },
      unreadsHeader: () => 'UNREADS',
      noUnreads: () => 'NO_UNREADS',
      baseUnread: (summary) => `BASE:${summary.count ?? 0}`,
      groupUnread: (summary) =>
        `GROUP:${summary.groupId}:${summary.count ?? 0}`,
      channelUnread: (summary) =>
        `CHANNEL:${summary.channelId}:${summary.count ?? 0}`,
    },
  };

  return {
    deps,
    calls,
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

describe('activity command run', () => {
  it('prints help without authenticating or calling the API', async () => {
    const context = makeDeps();

    const exitCode = await run(['--help'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.stdout()).toBe(`${ACTIVITY_HELP}\n`);
    expect(context.stderr()).toBe('');
    expect(context.calls.authenticate).toBe(0);
    expect(context.calls.getInitialActivity).toBe(0);
    expect(context.calls.getGroupAndChannelUnreads).toBe(0);
  });

  it('fails local usage errors before auth or API work', async () => {
    const cases = [
      { args: [] as string[], expected: 'Usage: tlon activity' },
      { args: ['bogus'], expected: 'Unknown activity command: bogus' },
      { args: ['mentions', 'extra'], expected: 'Unknown argument: extra' },
      { args: ['mentions', '--limit'], expected: '--limit requires a value' },
      {
        args: ['mentions', '--limit', 'abc'],
        expected: '--limit must be a positive integer',
      },
    ];

    for (const testCase of cases) {
      const context = makeDeps();
      const exitCode = await run(testCase.args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toContain(testCase.expected);
      expect(context.stderr()).toContain('Usage: tlon activity');
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.getInitialActivity).toBe(0);
      expect(context.calls.getGroupAndChannelUnreads).toBe(0);
    }
  });

  it('authenticates once, reads activity through injected API, and formats through deps', async () => {
    const context = makeDeps({
      events: [
        {
          id: 'old',
          bucketId: 'mentions',
          sourceId: 'source-old',
          type: 'post',
          timestamp: 1,
        },
        {
          id: 'reply',
          bucketId: 'replies',
          sourceId: 'source-reply',
          type: 'reply',
          timestamp: 3,
        },
        {
          id: 'new',
          bucketId: 'mentions',
          sourceId: 'source-new',
          type: 'post',
          timestamp: 5,
        },
      ],
    });

    const exitCode = await run(['mentions', '--limit', '1'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.getInitialActivity).toBe(1);
    expect(context.calls.getGroupAndChannelUnreads).toBe(0);
    expect(context.calls.eventFormatter).toEqual(['new']);
    expect(context.stdout()).toBe('HEADER:mentions:1\nEVENT:new\n\n');
    expect(context.stderr()).toBe('');
  });

  it('keeps only posts and replies at or after their source\'s first unread', async () => {
    const unreads: ActivityInit = {
      baseUnread: undefined,
      groupUnreads: [],
      channelUnreads: [
        {
          channelId: 'chat/~zod/test',
          type: 'channel',
          updatedAt: 1,
          count: 1,
          notify: false,
          countWithoutThreads: 1,
          firstUnreadPostId: '170.141.184.500',
        },
        {
          channelId: '~bus',
          type: 'dm',
          updatedAt: 1,
          count: 1,
          notify: false,
          countWithoutThreads: 1,
          firstUnreadPostId: '170.141.184.700',
        },
        {
          channelId: 'chat/~zod/quiet',
          type: 'channel',
          updatedAt: 1,
          count: 0,
          notify: false,
          countWithoutThreads: 0,
          firstUnreadPostId: null,
        },
      ],
      threadActivity: [
        {
          channelId: 'chat/~zod/test',
          threadId: '170.141.184.100',
          updatedAt: 1,
          count: 1,
          notify: false,
          firstUnreadPostId: '170.141.184.600',
        },
      ],
    };
    const post = (id: string, channelId: string, postId: string, timestamp: number) =>
      ({
        id,
        bucketId: 'mentions',
        sourceId: `channel/${channelId}`,
        type: 'post',
        timestamp,
        channelId,
        postId,
      }) as ActivityEvent;
    const reply = (id: string, postId: string, timestamp: number) =>
      ({
        id,
        bucketId: 'mentions',
        sourceId: 'thread/chat/~zod/test/170.141.184.100',
        type: 'reply',
        timestamp,
        channelId: 'chat/~zod/test',
        parentId: '170.141.184.100',
        postId,
      }) as ActivityEvent;
    const context = makeDeps({
      unreads,
      events: [
        post('read-post', 'chat/~zod/test', '170.141.184.499', 1),
        post('first-unread', 'chat/~zod/test', '170.141.184.500', 2),
        post('later-unread', 'chat/~zod/test', '170.141.184.501', 3),
        post('quiet-channel', 'chat/~zod/quiet', '170.141.184.900', 4),
        post('untracked-channel', 'chat/~zod/other', '170.141.184.900', 5),
        reply('read-reply', '170.141.184.599', 6),
        reply('unread-reply', '170.141.184.600', 7),
        post('read-dm', '~bus', '170.141.184.699', 8),
        post('unread-dm', '~bus', '170.141.184.701', 9),
        {
          id: 'join',
          bucketId: 'mentions',
          sourceId: 'group/~zod/test',
          type: 'group-join',
          timestamp: 10,
        },
      ],
    });

    const exitCode = await run(['mentions', '--unread'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.getGroupAndChannelUnreads).toBe(1);
    expect(context.calls.eventFormatter).toEqual([
      'unread-dm',
      'unread-reply',
      'later-unread',
      'first-unread',
    ]);
  });

  it('says there is no unread activity when --unread filters everything out', async () => {
    const context = makeDeps({
      events: [
        {
          id: 'old',
          bucketId: 'replies',
          sourceId: 'channel/chat/~zod/elsewhere',
          type: 'post',
          timestamp: 1,
          channelId: 'chat/~zod/elsewhere',
          postId: '170.141.184.1',
        } as ActivityEvent,
      ],
    });

    const exitCode = await run(['replies', '--unread'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.eventFormatter).toEqual([]);
    expect(context.stdout()).toBe('NO_UNREAD_ACTIVITY:replies\n');
  });

  it('does not fetch unreads without --unread', async () => {
    const context = makeDeps();

    await run(['mentions'], context.deps);

    expect(context.calls.getGroupAndChannelUnreads).toBe(0);
  });

  it('uses the injected unreads API and formatter', async () => {
    const context = makeDeps();

    const exitCode = await run(['unreads'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.authenticate).toBe(1);
    expect(context.calls.getInitialActivity).toBe(0);
    expect(context.calls.getGroupAndChannelUnreads).toBe(1);
    expect(context.stdout()).toContain('UNREADS\n');
    expect(context.stdout()).toContain('BASE:1\n');
    expect(context.stdout()).toContain('GROUP:~zod/test:2\n');
    expect(context.stdout()).toContain('CHANNEL:chat/~zod/test:3\n');
  });

  it('formats expected command/API failures through the shared command-error path', async () => {
    const context = makeDeps({
      getInitialActivity: async () => {
        throw commandError('activity API unavailable');
      },
    });

    const exitCode = await run(['mentions'], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: activity API unavailable\n');
    expect(context.calls.authenticate).toBe(1);
  });

  it('leaves unexpected exceptions for the adapter formatter', async () => {
    const context = makeDeps({
      getInitialActivity: async () => {
        throw new Error('unexpected failure');
      },
    });

    await expect(run(['mentions'], context.deps)).rejects.toThrow(
      'unexpected failure'
    );
    expect(context.stderr()).toBe('');
  });
});
