import { afterEach, describe, expect, it } from 'bun:test';

import { getChannelState } from './channel-state-runtime';
import { CommandError } from './commands/command';
import { mockedScry } from './tloncorp-api-mock';

afterEach(() => {
  mockedScry.impl = async () => undefined;
});

describe('getChannelState', () => {
  it('reads the order and group of a joined channel from /v5/channels', async () => {
    const received: unknown[] = [];
    mockedScry.impl = async (...args: unknown[]) => {
      received.push(args[0]);
      return {
        'chat/~host/channel': {
          perms: { group: '~host/group', writers: [] },
          order: ['170141184507'],
          view: 'list',
          sort: 'time',
          pending: { posts: {}, replies: {} },
          meta: null,
        },
      };
    };

    expect(await getChannelState('chat/~host/channel')).toEqual({
      joined: true,
      groupId: '~host/group',
      order: ['170141184507'],
    });
    expect(await getChannelState('chat/~host/other')).toEqual({
      joined: false,
    });
    expect(received).toEqual([
      { app: 'channels', path: '/v5/channels' },
      { app: 'channels', path: '/v5/channels' },
    ]);
  });

  it('turns a failed scry into a CommandError', async () => {
    mockedScry.impl = async () => {
      throw new Error('scry failed');
    };

    const failure = await getChannelState('chat/~host/channel').then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(CommandError);
    expect((failure as Error).message).toBe('scry failed');
  });
});
