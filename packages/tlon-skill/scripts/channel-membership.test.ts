import { describe, expect, it } from 'bun:test';

import {
  type ChannelMembershipDeps,
  joinChannelByNest,
  leaveChannelByNest,
} from './channel-membership';

const NEST = 'chat/~zod/general';
const GROUP = '~zod/team';

interface MakeDepsOptions {
  joined?: string[];
  groups?: Array<{ id: string; channelIds: string[] }>;
  leave?: ChannelMembershipDeps['leaveChannel'];
}

function makeDeps(options: MakeDepsOptions = {}) {
  const calls = {
    snapshot: 0,
    groupLookup: [] as string[],
    leave: [] as string[],
    join: [] as [string, string][],
    log: [] as string[],
  };
  const deps: ChannelMembershipDeps = {
    getSnapshot: async () => {
      calls.snapshot += 1;
      return {
        joinedChannelIds: new Set(options.joined ?? [NEST]),
        groups: options.groups ?? [{ id: GROUP, channelIds: [NEST] }],
      };
    },
    findGroupIdForChannel: async (nest) => {
      calls.groupLookup.push(nest);
      return (
        (options.groups ?? [{ id: GROUP, channelIds: [NEST] }]).find((group) =>
          group.channelIds.includes(nest)
        )?.id ?? null
      );
    },
    leaveChannel: async (nest) => {
      calls.leave.push(nest);
      return options.leave?.(nest);
    },
    joinChannel: async (nest, groupId) => {
      calls.join.push([nest, groupId]);
    },
    log: (line) => {
      calls.log.push(line);
    },
  };
  return { calls, deps };
}

describe('leaveChannelByNest', () => {
  it('leaves a joined channel and reports the group it stays in', async () => {
    const { calls, deps } = makeDeps();

    await leaveChannelByNest(NEST, deps);

    expect(calls.snapshot).toBe(1);
    expect(calls.groupLookup).toEqual([]);
    expect(calls.leave).toEqual([NEST]);
    expect(calls.log).toEqual([
      `✅ Left ${NEST}.`,
      `Still a member of group ${GROUP}.`,
    ]);
  });

  it('refuses a channel listed in a group but not joined, without poking', async () => {
    const { calls, deps } = makeDeps({ joined: [] });

    await expect(leaveChannelByNest(NEST, deps)).rejects.toThrow(
      `Not a member of ${NEST} (group ${GROUP}) — nothing to leave.`
    );
    expect(calls.leave).toEqual([]);
  });

  it('refuses an unknown channel without poking', async () => {
    const { calls, deps } = makeDeps({ joined: [], groups: [] });

    await expect(leaveChannelByNest(NEST, deps)).rejects.toThrow(
      `Channel ${NEST} not found.`
    );
    expect(calls.leave).toEqual([]);
  });

  it('normalizes a host without ~ before the lookup and the poke', async () => {
    const { calls, deps } = makeDeps();

    await leaveChannelByNest('chat/zod/general', deps);

    expect(calls.leave).toEqual([NEST]);
  });

  it('propagates a failed leave poke', async () => {
    const { calls, deps } = makeDeps({
      leave: async () => {
        throw new Error('poke nacked');
      },
    });

    await expect(leaveChannelByNest(NEST, deps)).rejects.toThrow('poke nacked');
    expect(calls.log).toEqual([]);
  });
});

describe('joinChannelByNest', () => {
  it('joins a channel in one of the groups', async () => {
    const { calls, deps } = makeDeps();

    await joinChannelByNest(NEST, deps);

    expect(calls.groupLookup).toEqual([NEST]);
    expect(calls.join).toEqual([[NEST, GROUP]]);
    expect(calls.log).toEqual([`✅ Joined ${NEST}.`]);
  });

  it('never loads the init snapshot', async () => {
    const { calls, deps } = makeDeps();
    deps.getSnapshot = async () => {
      throw new Error('join must not load the init snapshot');
    };

    await joinChannelByNest('chat/zod/general', deps);

    expect(calls.join).toEqual([[NEST, GROUP]]);
  });

  it('still joins an already-joined channel so subscriptions are repaired', async () => {
    const { calls, deps } = makeDeps();

    await joinChannelByNest(NEST, deps);

    expect(calls.join).toEqual([[NEST, GROUP]]);
  });

  it('refuses a channel not listed in any group, without poking', async () => {
    const { calls, deps } = makeDeps({
      groups: [{ id: GROUP, channelIds: ['chat/~zod/other'] }],
    });

    await expect(joinChannelByNest(NEST, deps)).rejects.toThrow(
      `Channel ${NEST} not found in any group you're in.`
    );
    expect(calls.join).toEqual([]);
  });
});

describe('nest validation', () => {
  it('rejects a malformed nest before any dep is called', async () => {
    const { calls, deps } = makeDeps();

    await expect(leaveChannelByNest('chat/~zod', deps)).rejects.toThrow(
      'Invalid nest format: chat/~zod. Expected: kind/~host/name'
    );
    await expect(joinChannelByNest('chat//general', deps)).rejects.toThrow(
      'Invalid nest format'
    );
    expect(calls.snapshot).toBe(0);
    expect(calls.groupLookup).toEqual([]);
  });
});
