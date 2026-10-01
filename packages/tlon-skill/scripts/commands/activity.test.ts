import { describe, expect, it } from 'bun:test';

import {
  ACTIVITY_HELP,
  type ActivityDeps,
  type ActivityEvent,
  run,
} from './activity';
import { commandError } from './command';

function makeDeps(
  options: {
    events?: ActivityEvent[];
    getInitialActivity?: ActivityDeps['activityApi']['getInitialActivity'];
    getGroupAndChannelUnreads?: ActivityDeps['activityApi']['getGroupAndChannelUnreads'];
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
      noActivity: (bucket) => `NO_ACTIVITY:${bucket}`,
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
