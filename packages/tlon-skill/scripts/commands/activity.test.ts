import type { VolumeMap, VolumeSettings } from '@tloncorp/api/urbit';
import { describe, expect, it } from 'bun:test';

import { volumeHelpers } from '../activity-runtime';
import type { ChannelState } from '../channel-state-runtime';
import { DIARY_REMOVED } from '../cli-utils';
import {
  ACTIVITY_COMMAND_HELP,
  ACTIVITY_HELP,
  type ActivityDeps,
  type ActivityEvent,
  type ActivityInit,
  BASE_LEVELS_MESSAGE,
  type ChannelUnread,
  DM_THREAD_REFUSAL,
  type GroupUnread,
  MARK_READ_ALL_WITH_TARGET,
  MARK_READ_POST_ID_MESSAGE,
  type MarkReadTarget,
  NOTES_MARK_READ_REFUSAL,
  NOTES_VOLUME_REFUSAL,
  type PokeOutcome,
  type RootPost,
  run,
} from './activity';
import { commandError } from './command';

// Volume deps that fail loudly: the activity feed and unreads commands must
// never reach them.
function unusedVolumeDeps(): Pick<
  ActivityDeps,
  | 'volumeApi'
  | 'volume'
  | 'readApi'
  | 'isJoinedGroup'
  | 'getChannelState'
  | 'findRootPost'
  | 'getCurrentUserId'
  | 'sleep'
> {
  const unused = () => {
    throw new Error('volume dependency used by a read command');
  };
  return {
    volumeApi: { adjustVolumeSetting: unused, getVolumeSettings: unused },
    volume: volumeHelpers,
    readApi: { markRead: unused, getUnreads: unused },
    isJoinedGroup: unused,
    getChannelState: unused,
    findRootPost: unused,
    getCurrentUserId: unused,
    sleep: unused,
  };
}

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
    ...unusedVolumeDeps(),
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

// Fixtures with distinct identities: the acting ship, the group host, the
// channel host and the thread's root author are all different ships.
const ACTING = '~bus';
const GROUP = '~zod/book-club';
const NEST = 'chat/~nec/general';
const AUTHOR = '~ten';
const CLUB = '0v1f.abcde';
const ROOT_ID = '170.141';

// `getVolumeMap(level, true)` written out, independent of the function:
// only reacts have unreads off.
const LOUD: VolumeMap = {
  post: { unreads: true, notify: true },
  'post-mention': { unreads: true, notify: true },
  reply: { unreads: true, notify: true },
  'reply-mention': { unreads: true, notify: true },
  react: { unreads: false, notify: true },
  'dm-react': { unreads: false, notify: true },
  'dm-invite': { unreads: true, notify: true },
  'dm-post': { unreads: true, notify: true },
  'dm-post-mention': { unreads: true, notify: true },
  'dm-reply': { unreads: true, notify: true },
  'dm-reply-mention': { unreads: true, notify: true },
  'group-ask': { unreads: true, notify: true },
  'group-join': { unreads: true, notify: true },
  'group-kick': { unreads: true, notify: true },
  'group-invite': { unreads: true, notify: true },
  'group-role': { unreads: true, notify: true },
  'flag-post': { unreads: true, notify: true },
  'flag-reply': { unreads: true, notify: true },
  'note-create': { unreads: true, notify: true },
  'note-edit': { unreads: true, notify: true },
};
const MEDIUM: VolumeMap = {
  post: { unreads: true, notify: true },
  'post-mention': { unreads: true, notify: true },
  reply: { unreads: true, notify: false },
  'reply-mention': { unreads: true, notify: true },
  react: { unreads: false, notify: true },
  'dm-react': { unreads: false, notify: true },
  'dm-invite': { unreads: true, notify: true },
  'dm-post': { unreads: true, notify: true },
  'dm-post-mention': { unreads: true, notify: true },
  'dm-reply': { unreads: true, notify: true },
  'dm-reply-mention': { unreads: true, notify: true },
  'group-ask': { unreads: true, notify: true },
  'group-join': { unreads: true, notify: false },
  'group-kick': { unreads: true, notify: false },
  'group-invite': { unreads: true, notify: true },
  'group-role': { unreads: true, notify: false },
  'flag-post': { unreads: true, notify: true },
  'flag-reply': { unreads: true, notify: true },
  'note-create': { unreads: true, notify: true },
  'note-edit': { unreads: true, notify: true },
};
const SOFT: VolumeMap = {
  post: { unreads: true, notify: false },
  'post-mention': { unreads: true, notify: true },
  reply: { unreads: true, notify: false },
  'reply-mention': { unreads: true, notify: true },
  react: { unreads: false, notify: false },
  'dm-react': { unreads: false, notify: false },
  'dm-invite': { unreads: true, notify: true },
  'dm-post': { unreads: true, notify: true },
  'dm-post-mention': { unreads: true, notify: true },
  'dm-reply': { unreads: true, notify: true },
  'dm-reply-mention': { unreads: true, notify: true },
  'group-ask': { unreads: true, notify: true },
  'group-join': { unreads: true, notify: false },
  'group-kick': { unreads: true, notify: false },
  'group-invite': { unreads: true, notify: true },
  'group-role': { unreads: true, notify: false },
  'flag-post': { unreads: true, notify: true },
  'flag-reply': { unreads: true, notify: true },
  'note-create': { unreads: true, notify: false },
  'note-edit': { unreads: true, notify: false },
};
const HUSH: VolumeMap = {
  post: { unreads: true, notify: false },
  'post-mention': { unreads: true, notify: false },
  reply: { unreads: true, notify: false },
  'reply-mention': { unreads: true, notify: false },
  react: { unreads: false, notify: false },
  'dm-react': { unreads: false, notify: false },
  'dm-invite': { unreads: true, notify: false },
  'dm-post': { unreads: true, notify: false },
  'dm-post-mention': { unreads: true, notify: false },
  'dm-reply': { unreads: true, notify: false },
  'dm-reply-mention': { unreads: true, notify: false },
  'group-ask': { unreads: true, notify: false },
  'group-join': { unreads: true, notify: false },
  'group-kick': { unreads: true, notify: false },
  'group-invite': { unreads: true, notify: false },
  'group-role': { unreads: true, notify: false },
  'flag-post': { unreads: true, notify: false },
  'flag-reply': { unreads: true, notify: false },
  'note-create': { unreads: true, notify: false },
  'note-edit': { unreads: true, notify: false },
};

const CHANNEL_SOURCE = { channel: { nest: NEST, group: GROUP } };
const BASE_SOURCE = { base: null };
// Base writes also clear `contact`, as the desk's default and hush templates do.
const baseMap = (map: VolumeMap): VolumeMap => ({
  ...map,
  contact: { unreads: false, notify: false },
});
const THREAD_SOURCE = {
  thread: {
    channel: NEST,
    group: GROUP,
    key: { id: `${AUTHOR}/${ROOT_ID}`, time: ROOT_ID },
  },
};

type Step<T> = T | Error | (() => Promise<T>);

function sequence<T>(steps: Step<T>[]): () => Promise<T> {
  let index = 0;
  return async () => {
    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;
    if (step instanceof Error) throw step;
    if (typeof step === 'function') return (step as () => Promise<T>)();
    return step;
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeVolumeContext(
  options: {
    groups?: string[] | Error;
    channelStates?: Step<ChannelState>[];
    roots?: Step<RootPost | null>[];
    poke?: Step<PokeOutcome>;
    // The stored settings before the command; the default store then applies
    // each poke the way the desk does (merge a map, delete on null).
    initial?: VolumeSettings;
    applyPoke?: boolean;
    // Replaces the store-backed read entirely.
    reads?: Step<VolumeSettings>[];
  } = {}
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const store: VolumeSettings = structuredClone(options.initial ?? {});
  const calls = {
    authenticate: 0,
    pokes: [] as Array<{ source: unknown; volume: VolumeMap | null }>,
    reads: 0,
    sleeps: [] as number[],
    isJoinedGroup: [] as string[],
    getChannelState: [] as string[],
    findRootPost: [] as Array<[string, string]>,
    order: [] as string[],
  };
  const nextChannelState = sequence<ChannelState>(
    options.channelStates ?? [{ joined: true, groupId: GROUP, order: [] }]
  );
  const nextRoot = sequence<RootPost | null>(
    options.roots ?? [{ id: ROOT_ID, authorId: AUTHOR, isDeleted: false }]
  );
  const nextPoke = sequence<PokeOutcome>([options.poke ?? { kind: 'acked' }]);
  const nextRead = options.reads
    ? sequence<VolumeSettings>(options.reads)
    : async () => structuredClone(store);

  const deps: ActivityDeps = {
    ...unusedVolumeDeps(),
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
      calls.order.push('authenticate');
    },
    activityApi: {
      getInitialActivity: async () => ({ events: [] }),
      getGroupAndChannelUnreads: async () => {
        throw new Error('unused');
      },
    },
    format: makeDeps().deps.format,
    volumeApi: {
      adjustVolumeSetting: async (source, volume) => {
        calls.pokes.push({ source, volume });
        calls.order.push('poke');
        const outcome = await nextPoke();
        calls.order.push('poke settled');
        if (outcome.kind !== 'nacked' && options.applyPoke !== false) {
          const key = volumeHelpers.sourceKey(source);
          if (volume) {
            store[key] = { ...(store[key] ?? {}), ...volume };
          } else {
            delete store[key];
          }
        }
        return outcome;
      },
      getVolumeSettings: async () => {
        calls.reads += 1;
        calls.order.push('read');
        return nextRead();
      },
    },
    volume: volumeHelpers,
    isJoinedGroup: async (flag) => {
      calls.isJoinedGroup.push(flag);
      if (options.groups instanceof Error) throw options.groups;
      return (options.groups ?? [GROUP]).includes(flag);
    },
    getChannelState: async (nest) => {
      calls.getChannelState.push(nest);
      return nextChannelState();
    },
    findRootPost: async (nest, id) => {
      calls.findRootPost.push([nest, id]);
      return nextRoot();
    },
    getCurrentUserId: () => ACTING,
    sleep: async (ms) => {
      calls.sleeps.push(ms);
    },
  };

  return {
    deps,
    calls,
    store,
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

describe('activity mute / unmute / volume: payloads', () => {
  const cases: Array<{
    args: string[];
    source: unknown;
    volume: VolumeMap | null;
  }> = [
    { args: ['mute', AUTHOR], source: { dm: { ship: AUTHOR } }, volume: HUSH },
    { args: ['mute', CLUB], source: { dm: { club: CLUB } }, volume: HUSH },
    { args: ['mute', GROUP], source: { group: GROUP }, volume: SOFT },
    { args: ['mute', NEST], source: CHANNEL_SOURCE, volume: HUSH },
    { args: ['mute', NEST, ROOT_ID], source: THREAD_SOURCE, volume: SOFT },
    {
      args: ['unmute', AUTHOR],
      source: { dm: { ship: AUTHOR } },
      volume: null,
    },
    { args: ['unmute', GROUP], source: { group: GROUP }, volume: null },
    { args: ['unmute', NEST], source: CHANNEL_SOURCE, volume: null },
    { args: ['unmute', NEST, ROOT_ID], source: THREAD_SOURCE, volume: null },
    {
      args: ['volume', GROUP, 'default'],
      source: { group: GROUP },
      volume: null,
    },
    { args: ['volume', NEST, 'loud'], source: CHANNEL_SOURCE, volume: LOUD },
    {
      args: ['volume', NEST, 'medium'],
      source: CHANNEL_SOURCE,
      volume: MEDIUM,
    },
    { args: ['volume', NEST, 'soft'], source: CHANNEL_SOURCE, volume: SOFT },
    { args: ['volume', NEST, 'hush'], source: CHANNEL_SOURCE, volume: HUSH },
    {
      args: ['volume', NEST, ROOT_ID, 'hush'],
      source: THREAD_SOURCE,
      volume: HUSH,
    },
    {
      args: ['volume', AUTHOR, 'medium'],
      source: { dm: { ship: AUTHOR } },
      volume: MEDIUM,
    },
    {
      args: ['volume', CLUB, 'hush'],
      source: { dm: { club: CLUB } },
      volume: HUSH,
    },
    {
      args: ['volume', 'base', 'medium'],
      source: BASE_SOURCE,
      volume: baseMap(MEDIUM),
    },
    {
      args: ['volume', 'base', 'soft'],
      source: BASE_SOURCE,
      volume: baseMap(SOFT),
    },
    {
      args: ['volume', 'base', 'hush'],
      source: BASE_SOURCE,
      volume: baseMap(HUSH),
    },
  ];

  for (const testCase of cases) {
    it(`${testCase.args.join(' ')} sends the app's exact source and map`, async () => {
      const context = makeVolumeContext();

      const exitCode = await run(testCase.args, context.deps);

      expect(context.stderr()).toBe('');
      expect(exitCode).toBe(0);
      expect(context.calls.authenticate).toBe(1);
      expect(context.calls.pokes).toEqual([
        { source: testCase.source, volume: testCase.volume },
      ]);
      expect(context.stdout()).toStartWith('✓ ');
    });
  }

  it('takes a channel group from the channel state, not the nest host', async () => {
    const context = makeVolumeContext();

    await run(['mute', NEST], context.deps);

    expect(context.calls.getChannelState[0]).toBe(NEST);
    const [{ source }] = context.calls.pokes;
    expect(source).toEqual({
      channel: { nest: NEST, group: '~zod/book-club' },
    });
  });

  it('keys a thread by its root author, not the acting ship or channel host', async () => {
    const context = makeVolumeContext();

    await run(['mute', NEST, ROOT_ID], context.deps);

    expect(context.calls.findRootPost[0]).toEqual([NEST, ROOT_ID]);
    const [{ source }] = context.calls.pokes;
    expect((source as typeof THREAD_SOURCE).thread.key.id.split('/')[0]).toBe(
      '~ten'
    );
  });

  it('mutes a DM with no prior conversation without any conversation lookup', async () => {
    const context = makeVolumeContext();

    const exitCode = await run(['mute', '~sampel-palnet'], context.deps);

    expect(exitCode).toBe(0);
    expect(context.calls.pokes).toEqual([
      { source: { dm: { ship: '~sampel-palnet' } }, volume: HUSH },
    ]);
    expect(context.calls.isJoinedGroup).toEqual([]);
    expect(context.calls.getChannelState).toEqual([]);
    expect(context.calls.findRootPost).toEqual([]);
    expect(context.stdout()).toStartWith(
      '✓ Muted DM with ~sampel-palnet for ~bus\n'
    );
  });

  it('accepts a comet and canonicalizes a channel host without ~', async () => {
    const comet = '~dalnel-fadpun-lapdys-ronfet--hinlyn-dirnux-sidwet-ravlyx';
    const dm = makeVolumeContext();
    expect(await run(['mute', comet], dm.deps)).toBe(0);
    expect(dm.calls.pokes[0].source).toEqual({ dm: { ship: comet } });

    const channel = makeVolumeContext();
    expect(await run(['mute', 'chat/nec/general'], channel.deps)).toBe(0);
    expect(channel.calls.getChannelState[0]).toBe(NEST);
    expect(channel.calls.pokes[0].source).toEqual(CHANNEL_SOURCE);
  });

  it('accepts an undotted root post id and sends it dotted', async () => {
    const context = makeVolumeContext({
      roots: [{ id: '170.141.184', authorId: AUTHOR, isDeleted: false }],
    });

    expect(await run(['mute', NEST, '170141184'], context.deps)).toBe(0);
    expect(context.calls.findRootPost[0]).toEqual([NEST, '170.141.184']);
    expect(context.calls.pokes[0].source).toEqual({
      thread: {
        channel: NEST,
        group: GROUP,
        key: { id: `${AUTHOR}/170.141.184`, time: '170.141.184' },
      },
    });
  });

  it('ignores --self before or after the target', async () => {
    const plain = makeVolumeContext();
    await run(['volume', NEST, 'soft'], plain.deps);

    for (const args of [
      ['volume', '--self', NEST, 'soft'],
      ['volume', NEST, 'soft', '--self'],
    ]) {
      const context = makeVolumeContext();
      expect(await run(args, context.deps)).toBe(0);
      expect(context.calls.pokes).toEqual(plain.calls.pokes);
      expect(context.stdout()).toBe(plain.stdout());
    }
  });

  it('accepts --self with volume base', async () => {
    for (const args of [
      ['volume', '--self', 'base', 'soft'],
      ['volume', 'base', 'soft', '--self'],
    ]) {
      const context = makeVolumeContext();
      expect(await run(args, context.deps)).toBe(0);
      expect(context.calls.pokes).toEqual([
        { source: BASE_SOURCE, volume: baseMap(SOFT) },
      ]);
    }
  });
});

describe('activity mute / unmute / volume: resolution refusals', () => {
  const cases: Array<{
    name: string;
    args: string[];
    options: Parameters<typeof makeVolumeContext>[0];
    message: string;
  }> = [
    {
      name: 'unjoined group',
      args: ['mute', GROUP],
      options: { groups: [] },
      message: `Group ${GROUP} is not joined on this ship; nothing changed.`,
    },
    {
      name: 'group read error',
      args: ['mute', GROUP],
      options: { groups: new Error('scry 500') },
      message: 'Could not read groups: scry 500; nothing changed.',
    },
    {
      name: 'unjoined channel',
      args: ['mute', NEST],
      options: { channelStates: [{ joined: false }] },
      message: `Channel ${NEST} is not joined on this ship; nothing changed.`,
    },
    {
      name: 'channel read error',
      args: ['mute', NEST, ROOT_ID],
      options: { channelStates: [new Error('scry 500')] },
      message: 'Could not read channels: scry 500; nothing changed.',
    },
    {
      name: 'missing root post',
      args: ['mute', NEST, ROOT_ID],
      options: { roots: [null] },
      message: `Could not find top-level post ${ROOT_ID} in ${NEST}; nothing changed. Threads are muted by their root post id.`,
    },
    {
      name: 'deleted root post',
      args: ['unmute', NEST, ROOT_ID],
      options: {
        roots: [{ id: ROOT_ID, authorId: AUTHOR, isDeleted: true }],
      },
      message: `Could not find top-level post ${ROOT_ID} in ${NEST}; nothing changed. Threads are muted by their root post id.`,
    },
    {
      name: 'root read error',
      args: ['mute', NEST, ROOT_ID],
      options: { roots: [new Error('scry 404')] },
      message: `Could not read ${NEST}: scry 404; nothing changed.`,
    },
  ];

  for (const testCase of cases) {
    it(`refuses an ${testCase.name} without poking`, async () => {
      const context = makeVolumeContext(testCase.options);

      const exitCode = await run(testCase.args, context.deps);

      expect(exitCode).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`Error: ${testCase.message}\n`);
      expect(context.calls.pokes).toEqual([]);
      expect(context.calls.reads).toBe(0);
    });
  }
});

describe('activity mute / unmute / volume: poke outcome', () => {
  it('reports a nack as a definitive failure without reading back', async () => {
    const context = makeVolumeContext({
      poke: { kind: 'nacked', message: 'bail: %activity crashed' },
    });

    const exitCode = await run(['mute', GROUP], context.deps);

    expect(exitCode).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not mute group ${GROUP}: bail: %activity crashed\n`
    );
    expect(context.calls.reads).toBe(0);
  });

  it('names the level in a failed volume change', async () => {
    const context = makeVolumeContext({
      poke: { kind: 'nacked', message: 'nack' },
    });

    expect(await run(['volume', AUTHOR, 'default'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not set DM with ${AUTHOR} to default: nack\n`
    );
  });

  it('confirms an unacknowledged DM or group change the read-back verifies', async () => {
    for (const args of [
      ['mute', GROUP],
      ['mute', AUTHOR],
      ['unmute', NEST],
    ]) {
      const context = makeVolumeContext({
        poke: { kind: 'ambiguous', message: 'Channel was reaped' },
      });

      expect(await run(args, context.deps)).toBe(0);
      expect(context.stdout()).toStartWith('✓ ');
      expect(context.stderr()).toBe('');
    }
  });

  it('keeps an unacknowledged channel or thread change unconfirmed even when the key matches', async () => {
    const message = 'Poke ack timed out after 30000ms';
    const channel = makeVolumeContext({
      poke: { kind: 'ambiguous', message },
      // An older override for the same nest under a former group: same key.
      initial: { [`channel/${NEST}`]: HUSH },
      applyPoke: false,
    });
    expect(await run(['mute', NEST], channel.deps)).toBe(1);
    expect(channel.stdout()).toBe('');
    expect(channel.stderr()).toBe(
      `Error: Mute of channel ${NEST} was sent but is not confirmed: the stored entry matches, but the poke was not acknowledged and the entry cannot be told apart from an older one for this channel under another group. Running the command again is safe. (poke error: ${message})\n`
    );

    const thread = makeVolumeContext({
      poke: { kind: 'ambiguous', message },
      // An older override for the same root id under another author.
      initial: { [`thread/${NEST}/${ROOT_ID}`]: SOFT },
      applyPoke: false,
    });
    expect(await run(['mute', NEST, ROOT_ID], thread.deps)).toBe(1);
    expect(thread.stdout()).toBe('');
    expect(thread.stderr()).toContain(
      'cannot be told apart from an older one for this thread under another group or root author'
    );
    expect(thread.stderr()).not.toContain('Muted');
  });

  it('keeps an unacknowledged channel change unconfirmed when the poke error has no message', async () => {
    // activity-runtime passes `error.message` through, so `new Error()` yields
    // an ambiguous outcome with an empty message.
    const context = makeVolumeContext({
      poke: { kind: 'ambiguous', message: new Error().message },
    });

    expect(await run(['mute', NEST], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Mute of channel ${NEST} was sent but is not confirmed: the stored entry matches, but the poke was not acknowledged and the entry cannot be told apart from an older one for this channel under another group. Running the command again is safe.\n`
    );
    expect(context.stderr()).not.toContain('✓');
  });

  it('keeps an unacknowledged thread change unconfirmed when the poke error has no message', async () => {
    const context = makeVolumeContext({
      poke: { kind: 'ambiguous', message: new Error().message },
    });

    expect(await run(['mute', NEST, ROOT_ID], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Mute of thread ${ROOT_ID} in ${NEST} was sent but is not confirmed: the stored entry matches, but the poke was not acknowledged and the entry cannot be told apart from an older one for this thread under another group or root author. Running the command again is safe.\n`
    );
    expect(context.stderr()).not.toContain('✓');
  });

  it('reports an unacknowledged change that never shows up as unconfirmed with the poke error', async () => {
    const context = makeVolumeContext({
      poke: { kind: 'ambiguous', message: 'Poke ack timed out after 30000ms' },
      applyPoke: false,
    });

    expect(await run(['mute', GROUP], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mute of group ${GROUP} was sent but is not confirmed: the stored setting is not set (follows the default). Running the command again is safe. (poke error: Poke ack timed out after 30000ms)\n`
    );
    expect(context.calls.reads).toBe(5);
  });

  it('starts reading back only after the poke settles', async () => {
    const gate = deferred<PokeOutcome>();
    const context = makeVolumeContext({ poke: () => gate.promise });

    const running = run(['mute', GROUP], context.deps);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.calls.pokes).toHaveLength(1);
    expect(context.calls.reads).toBe(0);

    gate.resolve({ kind: 'acked' });
    expect(await running).toBe(0);
    expect(context.calls.order).toEqual([
      'authenticate',
      'poke',
      'poke settled',
      'read',
    ]);
  });
});

describe('activity mute / unmute / volume: read-back', () => {
  it('prints nothing before the settings read resolves', async () => {
    const gate = deferred<VolumeSettings>();
    const context = makeVolumeContext({ reads: [() => gate.promise] });

    const running = run(['mute', GROUP], context.deps);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(context.calls.reads).toBe(1);
    expect(context.stdout()).toBe('');

    gate.resolve({ [`group/${GROUP}`]: SOFT });
    expect(await running).toBe(0);
    expect(context.stdout()).toStartWith(`✓ Muted group ${GROUP}`);
  });

  it('confirms on the first read', async () => {
    const context = makeVolumeContext();

    expect(await run(['mute', GROUP], context.deps)).toBe(0);
    expect(context.calls.reads).toBe(1);
    expect(context.calls.sleeps).toEqual([]);
  });

  it('confirms on the third read after two stale ones', async () => {
    const context = makeVolumeContext({
      reads: [{}, {}, { [`group/${GROUP}`]: SOFT }],
    });

    expect(await run(['mute', GROUP], context.deps)).toBe(0);
    expect(context.calls.reads).toBe(3);
    expect(context.calls.sleeps).toEqual([500, 500]);
  });

  it('reports unconfirmed after five reads that never show the change', async () => {
    const context = makeVolumeContext({ reads: [{}] });

    expect(await run(['volume', GROUP, 'hush'], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Setting group ${GROUP} to hush was sent but is not confirmed: the stored setting is not set (follows the default). Running the command again is safe.\n`
    );
    expect(context.calls.reads).toBe(5);
    expect(context.calls.sleeps).toEqual([500, 500, 500, 500]);
  });

  it('reports an unreadable setting with the last read error', async () => {
    const context = makeVolumeContext({ reads: [new Error('scry 500')] });

    expect(await run(['mute', AUTHOR], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mute of DM with ${AUTHOR} was sent but is not confirmed: the stored setting is unreadable. Running the command again is safe. (last read error: scry 500)\n`
    );
  });

  it('reports the inferred level when another level is stored', async () => {
    const context = makeVolumeContext({
      reads: [{ [`group/${GROUP}`]: LOUD }],
    });

    expect(await run(['mute', GROUP], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mute of group ${GROUP} was sent but is not confirmed: the stored setting is loud. Running the command again is safe.\n`
    );
  });

  it('does not confirm a map that differs only in unreads', async () => {
    const stored = structuredClone(SOFT);
    stored.post = { unreads: false, notify: false };
    const context = makeVolumeContext({
      reads: [{ [`group/${GROUP}`]: stored }],
    });

    expect(await run(['volume', GROUP, 'soft'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Setting group ${GROUP} to soft was sent but is not confirmed: the stored setting is soft but differs from the requested entries: post (stored notify false, unreads false; sent notify false, unreads true). Running the command again is safe.\n`
    );
  });

  it('does not confirm a map missing only note-edit', async () => {
    const stored = structuredClone(SOFT);
    delete stored['note-edit'];
    const context = makeVolumeContext({
      reads: [{ [`group/${GROUP}`]: stored }],
    });

    expect(await run(['mute', GROUP], context.deps)).toBe(1);
    expect(context.stderr()).toContain(
      'the stored setting is soft but differs from the requested entries: note-edit (missing).'
    );
  });

  it('confirms an unset when the key is absent and not while it remains', async () => {
    const cleared = makeVolumeContext({
      initial: { [`ship/${AUTHOR}`]: HUSH },
    });
    expect(await run(['unmute', AUTHOR], cleared.deps)).toBe(0);
    expect(cleared.store[`ship/${AUTHOR}`]).toBeUndefined();

    const remaining = makeVolumeContext({
      initial: { [`ship/${AUTHOR}`]: HUSH },
      applyPoke: false,
    });
    expect(await run(['unmute', AUTHOR], remaining.deps)).toBe(1);
    expect(remaining.stderr()).toBe(
      `Error: Unmute of DM with ${AUTHOR} was sent but is not confirmed: the stored setting is still hush. Running the command again is safe.\n`
    );
  });

  it('confirms an acked channel clear while an older entry for the nest remains under the key', async () => {
    // The desk keys channels by nest alone, so an older override for the same
    // nest under a former group survives the acked delete.
    const context = makeVolumeContext({
      initial: { [`group/${GROUP}`]: SOFT, [`channel/${NEST}`]: HUSH },
      applyPoke: false,
    });

    expect(await run(['unmute', NEST], context.deps)).toBe(0);
    expect(context.stderr()).toBe('');
    expect(context.stdout()).toBe(
      [
        `✓ Unmuted channel ${NEST} for ${ACTING}`,
        '  Level: default (follows Use workspace default: soft (Mentions and replies))',
        '  In the app: Channel options → Channel notifications',
        '',
      ].join('\n')
    );
    expect(context.stdout()).not.toContain('still');
    expect(context.calls.reads).toBe(1);
    expect(context.calls.sleeps).toEqual([]);
    expect(context.calls.getChannelState).toEqual([NEST, NEST]);
  });

  it('confirms an acked thread clear while an older entry for the root id remains under the key', async () => {
    const context = makeVolumeContext({
      initial: {
        [`channel/${NEST}`]: MEDIUM,
        [`thread/${NEST}/${ROOT_ID}`]: SOFT,
      },
      applyPoke: false,
    });

    expect(await run(['volume', NEST, ROOT_ID, 'default'], context.deps)).toBe(
      0
    );
    expect(context.stderr()).toBe('');
    expect(context.stdout()).toStartWith(
      `✓ Set thread ${ROOT_ID} in ${NEST} to default for ${ACTING}\n`
    );
    expect(context.stdout()).toContain(
      '  Level: default (follows Use channel default: medium ('
    );
    expect(context.stdout()).not.toContain('still');
    expect(context.calls.reads).toBe(1);
    expect(context.calls.sleeps).toEqual([]);
    expect(context.calls.findRootPost).toEqual([
      [NEST, ROOT_ID],
      [NEST, ROOT_ID],
    ]);
  });

  it('keeps an acked DM clear unconfirmed while the entry remains', async () => {
    const context = makeVolumeContext({
      initial: { [`ship/${AUTHOR}`]: HUSH },
      applyPoke: false,
    });

    expect(await run(['unmute', AUTHOR], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Unmute of DM with ${AUTHOR} was sent but is not confirmed: the stored setting is still hush. Running the command again is safe.\n`
    );
    expect(context.calls.reads).toBe(5);
  });

  it('keeps an unacknowledged channel clear unconfirmed while the entry remains', async () => {
    const message = 'Poke ack timed out after 30000ms';
    const context = makeVolumeContext({
      poke: { kind: 'ambiguous', message },
      initial: { [`channel/${NEST}`]: HUSH },
      applyPoke: false,
    });

    expect(await run(['unmute', NEST], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Unmute of channel ${NEST} was sent but is not confirmed: the stored setting is still hush. Running the command again is safe. (poke error: ${message})\n`
    );
    expect(context.calls.reads).toBe(5);
  });

  it('confirms every requested entry even when a legacy entry changes the inferred level', async () => {
    const context = makeVolumeContext({
      initial: {
        [`group/${GROUP}`]: { contact: { unreads: false, notify: false } },
      },
    });

    expect(await run(['volume', GROUP, 'loud'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Set group ${GROUP} to loud for ${ACTING}`,
        '  Level: soft (Mentions and replies)',
        '  Note: The stored map infers soft because it also contains legacy entries; all requested entries were verified.',
        '  In the app: Group options → Group notifications',
        '',
      ].join('\n')
    );
  });
});

describe('activity mute / unmute / volume: identity re-read', () => {
  const joined = (groupId: string): ChannelState => ({
    joined: true,
    groupId,
    order: [],
  });
  const root = (authorId: string, isDeleted = false): RootPost => ({
    id: ROOT_ID,
    authorId,
    isDeleted,
  });

  const cases: Array<{
    name: string;
    args: string[];
    options: Parameters<typeof makeVolumeContext>[0];
    reason: string;
  }> = [
    {
      name: "the channel's group changed",
      args: ['mute', NEST],
      options: { channelStates: [joined(GROUP), joined('~zod/other')] },
      reason: `the channel's group changed from ${GROUP} to ~zod/other while the setting was applied, so it may not take effect`,
    },
    {
      name: 'the channel is no longer joined',
      args: ['mute', NEST],
      options: { channelStates: [joined(GROUP), { joined: false }] },
      reason: `${NEST} is no longer joined`,
    },
    {
      name: 'the channel re-read fails',
      args: ['unmute', NEST],
      options: { channelStates: [joined(GROUP), new Error('scry 500')] },
      reason: 'the channel could not be re-read (scry 500)',
    },
    {
      name: "the root post's author changed",
      args: ['mute', NEST, ROOT_ID],
      options: { roots: [root(AUTHOR), root('~nec')] },
      reason: `the root post's author changed from ${AUTHOR} to ~nec while the setting was applied, so it may not take effect`,
    },
    {
      name: 'the root post was deleted',
      args: ['mute', NEST, ROOT_ID],
      options: { roots: [root(AUTHOR), root(AUTHOR, true)] },
      reason: `root post ${ROOT_ID} is no longer found`,
    },
    {
      name: 'the root post re-read fails',
      args: ['mute', NEST, ROOT_ID],
      options: { roots: [root(AUTHOR), new Error('scry 404')] },
      reason: 'the root post could not be re-read (scry 404)',
    },
  ];

  for (const testCase of cases) {
    it(`reports unconfirmed when ${testCase.name}`, async () => {
      const context = makeVolumeContext(testCase.options);

      expect(await run(testCase.args, context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toEndWith(
        `was sent but is not confirmed: ${testCase.reason}. Running the command again is safe.\n`
      );
      // The map matched on the first read; a changed identity is final.
      expect(context.calls.reads).toBe(1);
      expect(context.calls.sleeps).toEqual([]);
    });
  }

  it('confirms after re-reading an unchanged channel and root', async () => {
    const context = makeVolumeContext();

    expect(await run(['mute', NEST, ROOT_ID], context.deps)).toBe(0);
    expect(context.calls.getChannelState).toEqual([NEST, NEST]);
    expect(context.calls.findRootPost).toEqual([
      [NEST, ROOT_ID],
      [NEST, ROOT_ID],
    ]);
  });
});

describe('activity mute / unmute / volume: output', () => {
  it('prints a muted group', async () => {
    const context = makeVolumeContext();

    expect(await run(['mute', GROUP], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Muted group ${GROUP} for ${ACTING}`,
        '  Level: soft (Mentions and replies)',
        '  In the app: Group options → Group notifications',
        '',
      ].join('\n')
    );
  });

  it('prints a muted DM', async () => {
    const context = makeVolumeContext();

    expect(await run(['mute', AUTHOR], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Muted DM with ${AUTHOR} for ${ACTING}`,
        '  Level: hush (No notifications)',
        '  In the app: Chat options → Chat notifications',
        '',
      ].join('\n')
    );
  });

  it('prints an unmuted channel with the group level it now follows', async () => {
    const context = makeVolumeContext({
      initial: { [`group/${GROUP}`]: SOFT, [`channel/${NEST}`]: HUSH },
    });

    expect(await run(['unmute', NEST], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Unmuted channel ${NEST} for ${ACTING}`,
        '  Level: default (follows Use workspace default: soft (Mentions and replies))',
        '  In the app: Channel options → Channel notifications',
        '',
      ].join('\n')
    );
  });

  it('prints a muted thread', async () => {
    const context = makeVolumeContext();

    expect(await run(['mute', NEST, ROOT_ID], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Muted thread ${ROOT_ID} in ${NEST} for ${ACTING}`,
        '  Level: soft (Mentions and replies)',
        "  In the app: the root post's message menu → Mute thread / Unmute thread (shown once the post has replies)",
        '',
      ].join('\n')
    );
  });

  it('prints medium without the app enum padding', async () => {
    const context = makeVolumeContext();

    expect(await run(['volume', AUTHOR, 'medium'], context.deps)).toBe(0);
    expect(context.stdout()).toContain('  Level: medium (All posts)\n');
  });
});

describe('activity volume base', () => {
  // Base has no group, channel or root post to resolve or re-read.
  const expectNoLookups = (calls: {
    isJoinedGroup: string[];
    getChannelState: string[];
    findRootPost: Array<[string, string]>;
  }) => {
    expect(calls.isJoinedGroup).toEqual([]);
    expect(calls.getChannelState).toEqual([]);
    expect(calls.findRootPost).toEqual([]);
  };

  const baseLines = (level: string) =>
    [
      `Base notification level for ${ACTING}: ${level}`,
      '  Chats with their own level ignore base.',
      '  In the app: Settings → Notifications',
      '',
    ].join('\n');

  it('confirms base on the third read after two stale ones', async () => {
    const context = makeVolumeContext({
      reads: [{}, { base: MEDIUM }, { base: baseMap(SOFT) }],
    });

    expect(await run(['volume', 'base', 'soft'], context.deps)).toBe(0);
    expect(context.calls.reads).toBe(3);
    expect(context.calls.sleeps).toEqual([500, 500]);
  });

  it('reports an unconfirmed base write after five reads', async () => {
    const context = makeVolumeContext({
      initial: { base: MEDIUM },
      applyPoke: false,
    });

    expect(await run(['volume', 'base', 'soft'], context.deps)).toBe(1);
    expect(context.calls.reads).toBe(5);
    expect(context.stderr()).toContain(
      'Setting base notification level to soft was sent but is not confirmed: the stored setting is medium.'
    );
  });

  it('confirms an unacknowledged base write the read-back verifies', async () => {
    const context = makeVolumeContext({
      poke: { kind: 'ambiguous', message: 'timeout' },
    });

    expect(await run(['volume', 'base', 'hush'], context.deps)).toBe(0);
    expect(context.stdout()).toStartWith(
      '✓ Set base notification level to hush'
    );
  });

  it('clears a legacy loud contact entry when setting base', async () => {
    const context = makeVolumeContext({
      initial: {
        base: { ...LOUD, contact: { unreads: true, notify: true } },
      },
    });

    expect(await run(['volume', 'base', 'hush'], context.deps)).toBe(0);
    expect(context.calls.pokes).toEqual([
      { source: BASE_SOURCE, volume: baseMap(HUSH) },
    ]);
    expect(context.store.base?.contact).toEqual({
      unreads: false,
      notify: false,
    });
    expect(context.stdout()).toContain('  Level: hush (Nothing)\n');
  });

  it('infers each base level from the map it sends', () => {
    for (const level of ['medium', 'soft', 'hush'] as const) {
      expect(
        volumeHelpers.levelOf(baseMap(volumeHelpers.mapForLevel(level)))
      ).toBe(level);
    }
  });

  it('confirms a base write over a desk-seeded map with a contact key', async () => {
    const context = makeVolumeContext({
      initial: {
        base: { ...MEDIUM, contact: { unreads: false, notify: false } },
      },
    });

    expect(await run(['volume', 'base', 'hush'], context.deps)).toBe(0);
    expect(context.stdout()).toContain('  Level: hush (Nothing)\n');
  });

  it('prints a set base level with the app label and exceptions note', async () => {
    const context = makeVolumeContext();

    expect(await run(['volume', 'base', 'soft'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Set base notification level to soft for ${ACTING}`,
        '  Level: soft (DMs, mentions, and replies only)',
        '  Chats with their own level ignore base.',
        '  In the app: Settings → Notifications',
        '',
      ].join('\n')
    );
    expectNoLookups(context.calls);
  });

  it('shows a stored base level without poking', async () => {
    const context = makeVolumeContext({ initial: { base: SOFT } });

    expect(await run(['volume', 'base'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      baseLines('soft (DMs, mentions, and replies only)')
    );
    expect(context.calls.pokes).toEqual([]);
    expect(context.calls.reads).toBe(1);
    expect(context.calls.authenticate).toBe(1);
    expectNoLookups(context.calls);
  });

  it('shows a missing or null base level as medium', async () => {
    for (const initial of [{}, { base: null }] as VolumeSettings[]) {
      const context = makeVolumeContext({ initial });

      expect(await run(['volume', 'base'], context.deps)).toBe(0);
      expect(context.stdout()).toBe(
        baseLines('medium (All DMs and workspace posts)')
      );
      expect(context.calls.pokes).toEqual([]);
    }
  });

  it('shows a stored loud base level', async () => {
    const context = makeVolumeContext({ initial: { base: LOUD } });

    expect(await run(['volume', 'base'], context.deps)).toBe(0);
    expect(context.stdout()).toContain('loud (All activity)');
  });

  it('shows the base level with --self', async () => {
    const plain = makeVolumeContext({ initial: { base: HUSH } });
    expect(await run(['volume', 'base'], plain.deps)).toBe(0);

    const context = makeVolumeContext({ initial: { base: HUSH } });
    expect(await run(['volume', 'base', '--self'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(plain.stdout());
    expect(context.calls.pokes).toEqual([]);
  });

  it('reports an unreadable base level', async () => {
    const context = makeVolumeContext({
      reads: [commandError('scry 500')],
    });

    expect(await run(['volume', 'base'], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe('Error: scry 500\n');
    expect(context.calls.pokes).toEqual([]);
    expect(context.calls.reads).toBe(1);
    expect(context.calls.sleeps).toEqual([]);
  });

  it('prints volume help for volume base --help', async () => {
    const context = makeVolumeContext();

    expect(await run(['volume', 'base', '--help'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(`${ACTIVITY_COMMAND_HELP.volume}\n`);
    expect(context.calls.authenticate).toBe(0);
  });
});

describe('activity mute / unmute / volume: arguments', () => {
  const channelHint =
    '(expected chat/~host/channel-slug or heap/~host/channel-slug)';
  const usageCases: Array<{ args: string[]; message: string | null }> = [
    {
      args: ['mute', '~foo'],
      message: 'Invalid ship: ~foo (expected a ship such as ~sampel-palnet)',
    },
    {
      args: ['mute', '~ZOD'],
      message: 'Invalid ship: ~ZOD (expected a ship such as ~sampel-palnet)',
    },
    {
      args: ['mute', '0v4.abc'],
      message:
        'Invalid group-DM id: 0v4.abc (expected a 0v... id such as 0v1f.abcde)',
    },
    {
      args: ['mute', '~h/g'],
      message: 'Invalid group id: ~h/g (expected ~host/group-slug)',
    },
    {
      args: ['mute', '~zod/'],
      message: 'Invalid group id: ~zod/ (expected ~host/group-slug)',
    },
    {
      args: ['mute', 'chat//general'],
      message: `Invalid channel: chat//general ${channelHint}`,
    },
    {
      args: ['mute', 'chat/~zod/General'],
      message: `Invalid channel: chat/~zod/General ${channelHint}`,
    },
    {
      args: ['mute', 'chat/~foo/general'],
      message: `Invalid channel: chat/~foo/general ${channelHint}`,
    },
    {
      args: ['mute', 'pond/~zod/x'],
      message: 'Unsupported channel kind: pond. Use chat/ or heap/',
    },
    ...['a/b/c/d', 'zod'].map((target) => ({
      args: ['mute', target],
      message: `Unrecognized target: ${target}. Use ~ship, a group-DM id (0v...), ~host/group, chat/~host/name or heap/~host/name, or a channel and a post id for a thread`,
    })),
    ...['.', '1..2', '0170', '170.1', '~ten/170.141', '1e3'].map((id) => ({
      args: ['mute', NEST, id],
      message: `Invalid post id: ${id} (expected a numeric post id such as 170.141.184.507)`,
    })),
    {
      args: ['volume', NEST, 'LOUD'],
      message: 'Unknown level: LOUD. Levels: loud, medium, soft, hush, default',
    },
    {
      args: ['volume', AUTHOR, 'loud'],
      message:
        'DMs take medium, hush or default (the app offers only these for DMs)',
    },
    {
      args: ['volume', CLUB, 'soft'],
      message:
        'DMs take medium, hush or default (the app offers only these for DMs)',
    },
    {
      args: ['mute', GROUP, ROOT_ID],
      message: 'A thread needs a channel (chat/~host/name), not a group id',
    },
    { args: ['mute', GROUP, '--force'], message: 'Unknown option: --force' },
    {
      args: ['mute', NEST, ROOT_ID, 'extra'],
      message: 'Unexpected argument: extra',
    },
    {
      args: ['volume', NEST, ROOT_ID, 'soft', 'extra'],
      message: 'Unexpected argument: extra',
    },
    { args: ['volume', 'base', 'default'], message: BASE_LEVELS_MESSAGE },
    { args: ['volume', 'base', 'loud'], message: BASE_LEVELS_MESSAGE },
    {
      args: ['volume', 'base', 'bogus'],
      message: 'Unknown level: bogus. Levels for base: medium, soft, hush',
    },
    {
      args: ['volume', 'base', 'MEDIUM'],
      message: 'Unknown level: MEDIUM. Levels for base: medium, soft, hush',
    },
    {
      args: ['volume', 'base', 'soft', 'extra'],
      message: 'Unexpected argument: extra',
    },
    { args: ['volume', 'base', '--bogus'], message: 'Unknown option: --bogus' },
    ...(['mute', 'unmute'] as const).map((command) => ({
      args: [command, 'base'],
      message:
        'Unrecognized target: base. Use ~ship, a group-DM id (0v...), ~host/group, chat/~host/name or heap/~host/name, or a channel and a post id for a thread',
    })),
    { args: ['mute'], message: null },
    { args: ['unmute', '--self'], message: null },
    { args: ['volume', GROUP], message: null },
  ];

  for (const testCase of usageCases) {
    it(`rejects ${testCase.args.join(' ')} before authenticating`, async () => {
      const context = makeVolumeContext();
      const command = testCase.args[0] as keyof typeof ACTIVITY_COMMAND_HELP;

      expect(await run(testCase.args, context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        testCase.message === null
          ? `${ACTIVITY_COMMAND_HELP[command]}\n`
          : `Error: ${testCase.message}\n\n${ACTIVITY_COMMAND_HELP[command]}\n`
      );
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.pokes).toEqual([]);
    });
  }

  const refusals: Array<{ args: string[]; message: string }> = [
    { args: ['mute', 'notes/~zod/blog'], message: NOTES_VOLUME_REFUSAL },
    {
      args: ['volume', 'notes/~zod/blog', 'soft'],
      message: NOTES_VOLUME_REFUSAL,
    },
    { args: ['mute', 'diary/~zod/blog'], message: DIARY_REMOVED },
    { args: ['mute', AUTHOR, ROOT_ID], message: DM_THREAD_REFUSAL },
    { args: ['unmute', CLUB, ROOT_ID], message: DM_THREAD_REFUSAL },
  ];

  for (const testCase of refusals) {
    it(`refuses ${testCase.args.join(' ')} locally`, async () => {
      const context = makeVolumeContext();

      expect(await run(testCase.args, context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`Error: ${testCase.message}\n`);
      expect(context.calls.authenticate).toBe(0);
    });
  }

  it('prints per-command help without authenticating', async () => {
    for (const command of ['mute', 'unmute', 'volume'] as const) {
      for (const args of [
        [command, '--help'],
        [command, NEST, '-h'],
      ]) {
        const context = makeVolumeContext();
        expect(await run(args, context.deps)).toBe(0);
        expect(context.stdout()).toBe(`${ACTIVITY_COMMAND_HELP[command]}\n`);
        expect(context.calls.authenticate).toBe(0);
      }
    }
  });

  it('keeps help free of harness names', () => {
    for (const help of [
      ACTIVITY_HELP,
      ...Object.values(ACTIVITY_COMMAND_HELP),
    ]) {
      expect(help).not.toContain('OpenClaw');
    }
  });
});

const dmSummary = (
  channelId: string,
  count: number,
  updatedAt = 1,
  notify = false
): ChannelUnread => ({
  channelId,
  type: 'dm',
  count,
  notify,
  countWithoutThreads: count,
  updatedAt,
});
const channelSummary = (
  channelId: string,
  count: number,
  updatedAt = 1,
  notify = false
): ChannelUnread => ({
  channelId,
  type: 'channel',
  count,
  notify,
  countWithoutThreads: count,
  updatedAt,
});
const groupSummary = (
  groupId: string,
  count: number,
  updatedAt = 1,
  notify = false
): GroupUnread => ({ groupId, count, notify, updatedAt });

function unreads(
  summaries: Array<ChannelUnread | GroupUnread> = []
): ActivityInit {
  return {
    groupUnreads: summaries.filter(
      (summary): summary is GroupUnread => 'groupId' in summary
    ),
    channelUnreads: summaries.filter(
      (summary): summary is ChannelUnread => 'channelId' in summary
    ),
    threadActivity: [],
  };
}
const NONE = unreads();

function makeReadContext(
  options: {
    groups?: string[];
    channelStates?: Step<ChannelState>[];
    poke?: Step<PokeOutcome>;
    // The snapshot first, then each read-back; the last step repeats.
    unreads?: Step<ActivityInit>[];
  } = {}
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const calls = {
    authenticate: 0,
    marks: [] as MarkReadTarget[],
    unreadReads: 0,
    sleeps: [] as number[],
    isJoinedGroup: [] as string[],
    getChannelState: [] as string[],
    order: [] as string[],
  };
  const nextChannelState = sequence<ChannelState>(
    options.channelStates ?? [{ joined: true, groupId: GROUP, order: [] }]
  );
  const nextPoke = sequence<PokeOutcome>([options.poke ?? { kind: 'acked' }]);
  const nextUnreads = sequence<ActivityInit>(options.unreads ?? [NONE]);

  const deps: ActivityDeps = {
    ...unusedVolumeDeps(),
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {
      calls.authenticate += 1;
      calls.order.push('authenticate');
    },
    activityApi: {
      getInitialActivity: async () => ({ events: [] }),
      getGroupAndChannelUnreads: async () => {
        throw new Error('unused');
      },
    },
    format: makeDeps().deps.format,
    readApi: {
      markRead: async (target) => {
        calls.marks.push(target);
        calls.order.push('mark');
        const outcome = await nextPoke();
        calls.order.push('mark settled');
        return outcome;
      },
      getUnreads: async () => {
        calls.unreadReads += 1;
        calls.order.push('unreads');
        return nextUnreads();
      },
    },
    isJoinedGroup: async (flag) => {
      calls.isJoinedGroup.push(flag);
      return (options.groups ?? [GROUP]).includes(flag);
    },
    getChannelState: async (nest) => {
      calls.getChannelState.push(nest);
      return nextChannelState();
    },
    getCurrentUserId: () => ACTING,
    sleep: async (ms) => {
      calls.sleeps.push(ms);
    },
  };

  return {
    deps,
    calls,
    stdout: () => stdout.join(''),
    stderr: () => stderr.join(''),
  };
}

const DM_WHERE = 'Workspaces tab → press and hold the chat → Mark as read';
const CHANNEL_WHERE =
  'open its group → press and hold the channel → Mark as read';
const GROUP_WHERE =
  'Workspaces tab → press and hold the group → Mark all as read';
const ALL_WHERE = 'Activity tab → ⋯ → Mark all as read';
const RERUN = 'Running the command again is safe.';

describe('activity mark-read: payloads', () => {
  const cases: Array<{ args: string[]; target: MarkReadTarget }> = [
    { args: [AUTHOR], target: { kind: 'dm-ship', ship: AUTHOR } },
    { args: [CLUB], target: { kind: 'dm-club', club: CLUB } },
    { args: [GROUP], target: { kind: 'group', flag: GROUP } },
    { args: [NEST], target: { kind: 'channel', nest: NEST, groupId: GROUP } },
    {
      args: ['heap/~nec/pics'],
      target: { kind: 'channel', nest: 'heap/~nec/pics', groupId: GROUP },
    },
    { args: ['--all'], target: { kind: 'all' } },
  ];

  for (const testCase of cases) {
    it(`mark-read ${testCase.args.join(' ')} sends the exact read target`, async () => {
      const context = makeReadContext();

      expect(await run(['mark-read', ...testCase.args], context.deps)).toBe(0);
      expect(context.calls.marks).toEqual([testCase.target]);
      expect(context.stdout().startsWith('✓ ')).toBe(true);
      expect(context.stderr()).toBe('');
      expect(context.calls.order).toEqual([
        'authenticate',
        'unreads',
        'mark',
        'mark settled',
        'unreads',
      ]);
    });
  }

  it('takes a channel group from the channel state, not the nest host', async () => {
    const context = makeReadContext();

    expect(await run(['mark-read', NEST], context.deps)).toBe(0);
    expect(context.calls.marks).toEqual([
      { kind: 'channel', nest: NEST, groupId: '~zod/book-club' },
    ]);
  });

  it('ignores --self before or after the target and with --all', async () => {
    for (const args of [
      ['mark-read', '--self', AUTHOR],
      ['mark-read', AUTHOR, '--self'],
    ]) {
      const context = makeReadContext();
      expect(await run(args, context.deps)).toBe(0);
      expect(context.calls.marks).toEqual([{ kind: 'dm-ship', ship: AUTHOR }]);
    }
    const context = makeReadContext();
    expect(await run(['mark-read', '--all', '--self'], context.deps)).toBe(0);
    expect(context.calls.marks).toEqual([{ kind: 'all' }]);
  });
});

describe('activity mark-read: resolution', () => {
  it('refuses a group that is not joined without reading or marking', async () => {
    const context = makeReadContext({ groups: [] });

    expect(await run(['mark-read', '~zod/other'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      'Error: Group ~zod/other is not joined on this ship; nothing changed.\n'
    );
    expect(context.calls.marks).toEqual([]);
    expect(context.calls.unreadReads).toBe(0);
  });

  it('refuses a channel that is not joined without reading or marking', async () => {
    const context = makeReadContext({
      channelStates: [{ joined: false }],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Channel ${NEST} is not joined on this ship; nothing changed.\n`
    );
    expect(context.calls.marks).toEqual([]);
    expect(context.calls.unreadReads).toBe(0);
  });

  it('reports an unreadable channel state without marking', async () => {
    const context = makeReadContext({
      channelStates: [new Error('scry 500')],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      'Error: Could not read channels: scry 500; nothing changed.\n'
    );
    expect(context.calls.marks).toEqual([]);
  });

  it('reports an unreadable snapshot without marking', async () => {
    for (const args of [[GROUP], ['--all']]) {
      const context = makeReadContext({ unreads: [new Error('scry 500')] });

      expect(await run(['mark-read', ...args], context.deps)).toBe(1);
      expect(context.stderr()).toBe(
        'Error: Could not read unreads: scry 500; nothing changed.\n'
      );
      expect(context.calls.marks).toEqual([]);
      expect(context.calls.unreadReads).toBe(1);
    }
  });

  it('makes no identity lookups for DM, group DM or group targets', async () => {
    for (const target of [AUTHOR, CLUB, GROUP]) {
      const context = makeReadContext();
      expect(await run(['mark-read', target], context.deps)).toBe(0);
      expect(context.calls.getChannelState).toEqual([]);
    }
  });
});

describe('activity mark-read: read-back', () => {
  it('confirms a group on the first read', async () => {
    const context = makeReadContext({
      unreads: [unreads([groupSummary(GROUP, 14)]), unreads([])],
    });

    expect(await run(['mark-read', GROUP], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked group ${GROUP} read for ${ACTING} (cleared 14 unreads)\n  In the app: ${GROUP_WHERE}\n`
    );
    expect(context.calls.sleeps).toEqual([]);
  });

  it('confirms a DM whose summary stays with a zero count', async () => {
    const context = makeReadContext({
      unreads: [
        unreads([dmSummary(AUTHOR, 3)]),
        unreads([dmSummary(AUTHOR, 0)]),
      ],
    });

    expect(await run(['mark-read', AUTHOR], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked DM with ${AUTHOR} read for ${ACTING} (cleared 3 unreads)\n  In the app: ${DM_WHERE}\n`
    );
  });

  it('says one unread in the singular', async () => {
    const context = makeReadContext({
      unreads: [unreads([dmSummary(CLUB, 1)]), NONE],
    });

    expect(await run(['mark-read', CLUB], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked group DM ${CLUB} read for ${ACTING} (cleared 1 unread)\n  In the app: ${DM_WHERE}\n`
    );
  });

  it('still sends the read when the snapshot shows nothing', async () => {
    for (const snapshot of [NONE, unreads([channelSummary(NEST, 0)])]) {
      const context = makeReadContext({ unreads: [snapshot, NONE] });

      expect(await run(['mark-read', NEST], context.deps)).toBe(0);
      expect(context.calls.marks).toHaveLength(1);
      expect(context.stdout()).toBe(
        `✓ Marked channel ${NEST} read for ${ACTING} (no reported unreads)\n  In the app: ${CHANNEL_WHERE}\n`
      );
    }
  });

  it('reports a cleared notification when the count was zero', async () => {
    const context = makeReadContext({
      unreads: [unreads([channelSummary(NEST, 0, 1, true)]), NONE],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked channel ${NEST} read for ${ACTING} (cleared its notification)\n  In the app: ${CHANNEL_WHERE}\n`
    );
  });

  it('confirms on the third read after two stale ones', async () => {
    const stale = unreads([groupSummary(GROUP, 2)]);
    const context = makeReadContext({
      unreads: [stale, stale, stale, NONE],
    });

    expect(await run(['mark-read', GROUP], context.deps)).toBe(0);
    expect(context.calls.sleeps).toEqual([500, 500]);
    expect(context.calls.unreadReads).toBe(4);
  });

  it('reports unconfirmed after five reads that still show the unreads', async () => {
    const context = makeReadContext({
      unreads: [unreads([dmSummary(AUTHOR, 3)])],
    });

    expect(await run(['mark-read', AUTHOR], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Mark read of DM with ${AUTHOR} was sent but is not confirmed: it still shows 3 unreads. ${RERUN}\n`
    );
    expect(context.calls.unreadReads).toBe(6);
    expect(context.calls.sleeps).toEqual([500, 500, 500, 500]);
  });

  it('keeps a remaining notification unconfirmed', async () => {
    const context = makeReadContext({
      unreads: [
        unreads([channelSummary(NEST, 2, 5)]),
        unreads([channelSummary(NEST, 0, 5, true)]),
      ],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark read of channel ${NEST} was sent but is not confirmed: it still shows a notification. ${RERUN}\n`
    );
  });

  it('keeps unchanged or older recency unconfirmed even when acked', async () => {
    for (const updatedAt of [5, 4]) {
      const context = makeReadContext({
        unreads: [
          unreads([groupSummary(GROUP, 2, 5)]),
          unreads([groupSummary(GROUP, 2, updatedAt)]),
        ],
      });

      expect(await run(['mark-read', GROUP], context.deps)).toBe(1);
      expect(context.stderr()).toBe(
        `Error: Mark read of group ${GROUP} was sent but is not confirmed: it still shows 2 unreads. ${RERUN}\n`
      );
    }
  });

  it('reports new activity after an acked read and stops reading', async () => {
    const context = makeReadContext({
      unreads: [
        unreads([channelSummary(NEST, 2, 1)]),
        unreads([channelSummary(NEST, 2, 2)]),
      ],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked channel ${NEST} read for ${ACTING}; new activity arrived after the read (2 unreads now)\n  In the app: ${CHANNEL_WHERE}\n`
    );
    expect(context.calls.unreadReads).toBe(2);
    expect(context.calls.sleeps).toEqual([]);
  });

  it('reports new activity on a source absent from the snapshot', async () => {
    const context = makeReadContext({
      unreads: [NONE, unreads([dmSummary(AUTHOR, 1, 7)])],
    });

    expect(await run(['mark-read', AUTHOR], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked DM with ${AUTHOR} read for ${ACTING}; new activity arrived after the read (1 unread now)\n  In the app: ${DM_WHERE}\n`
    );
  });

  it('keeps moved recency unconfirmed when the poke was not acknowledged', async () => {
    const context = makeReadContext({
      poke: { kind: 'ambiguous', message: 'Poke ack timed out after 30000ms' },
      unreads: [
        unreads([channelSummary(NEST, 2, 1)]),
        unreads([channelSummary(NEST, 2, 2)]),
      ],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark read of channel ${NEST} was sent but is not confirmed: it still shows 2 unreads, and new activity arrived, so it is unknown whether the read applied. ${RERUN} (poke error: Poke ack timed out after 30000ms)\n`
    );
    expect(context.calls.unreadReads).toBe(6);
  });

  it('keeps an unacknowledged read with nothing visible before unconfirmed', async () => {
    for (const snapshot of [NONE, unreads([channelSummary(NEST, 0)])]) {
      const context = makeReadContext({
        poke: {
          kind: 'ambiguous',
          message: 'Poke ack timed out after 30000ms',
        },
        unreads: [snapshot, NONE],
      });

      expect(await run(['mark-read', NEST], context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        `Error: Mark read of channel ${NEST} was sent but is not confirmed: the read was not acknowledged and a channel's summary cannot show thread-only unreads. ${RERUN} (poke error: Poke ack timed out after 30000ms)\n`
      );
      expect(context.calls.unreadReads).toBe(2);
      expect(context.calls.sleeps).toEqual([]);
    }
  });

  it('confirms an unacknowledged read the read-back shows cleared', async () => {
    const context = makeReadContext({
      poke: { kind: 'ambiguous', message: 'Channel was reaped' },
      unreads: [unreads([groupSummary(GROUP, 4)]), NONE],
    });

    expect(await run(['mark-read', GROUP], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked group ${GROUP} read for ${ACTING} (cleared 4 unreads)\n  In the app: ${GROUP_WHERE}\n`
    );
  });

  it('reports a nack without reading back', async () => {
    const context = makeReadContext({
      poke: { kind: 'nacked', message: 'bail: %activity crashed' },
      unreads: [unreads([groupSummary(GROUP, 4)])],
    });

    expect(await run(['mark-read', GROUP], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Could not mark group ${GROUP} read: bail: %activity crashed\n`
    );
    expect(context.calls.unreadReads).toBe(1);
  });

  it('reports an unreadable read-back with the last read error', async () => {
    const context = makeReadContext({
      unreads: [unreads([groupSummary(GROUP, 4)]), new Error('scry 500')],
    });

    expect(await run(['mark-read', GROUP], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark read of group ${GROUP} was sent but is not confirmed: the unreads could not be read. ${RERUN} (last read error: scry 500)\n`
    );
    expect(context.calls.unreadReads).toBe(6);
  });

  it('confirms after a transient read-back error', async () => {
    const context = makeReadContext({
      unreads: [unreads([groupSummary(GROUP, 4)]), new Error('scry 500'), NONE],
    });

    expect(await run(['mark-read', GROUP], context.deps)).toBe(0);
    expect(context.calls.sleeps).toEqual([500]);
  });

  it('prints nothing before the read-back resolves', async () => {
    const entered = deferred<void>();
    const gate = deferred<ActivityInit>();
    const context = makeReadContext({
      unreads: [
        unreads([groupSummary(GROUP, 4)]),
        () => {
          entered.resolve();
          return gate.promise;
        },
      ],
    });

    const running = run(['mark-read', GROUP], context.deps);
    await entered.promise;
    expect(context.calls.unreadReads).toBe(2);
    expect(context.stdout()).toBe('');
    gate.resolve(NONE);
    expect(await running).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked group ${GROUP} read for ${ACTING} (cleared 4 unreads)\n  In the app: ${GROUP_WHERE}\n`
    );
  });
});

describe('activity mark-read: channel identity', () => {
  const MOVED = '~zod/other-club';

  it('rejects an apparently cleared channel whose group changed', async () => {
    const context = makeReadContext({
      channelStates: [
        { joined: true, groupId: GROUP, order: [] },
        { joined: true, groupId: MOVED, order: [] },
      ],
      unreads: [unreads([channelSummary(NEST, 3)]), NONE],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark read of channel ${NEST} was sent but is not confirmed: the channel's group changed from ${GROUP} to ${MOVED} while the read was sent, so the read may not have applied. ${RERUN}\n`
    );
    expect(context.calls.getChannelState).toEqual([NEST, NEST]);
  });

  it('rejects new activity on a channel whose group changed', async () => {
    const context = makeReadContext({
      channelStates: [
        { joined: true, groupId: GROUP, order: [] },
        { joined: true, groupId: MOVED, order: [] },
      ],
      unreads: [
        unreads([channelSummary(NEST, 3, 1)]),
        unreads([channelSummary(NEST, 3, 2)]),
      ],
    });

    expect(await run(['mark-read', NEST], context.deps)).toBe(1);
    expect(context.stderr()).toContain(
      `the channel's group changed from ${GROUP} to ${MOVED} while the read was sent`
    );
  });

  it('rejects a channel that was left or cannot be re-read', async () => {
    const cases: Array<{ state: Step<ChannelState>; reason: string }> = [
      {
        state: { joined: false },
        reason: `${NEST} is no longer joined`,
      },
      {
        state: new Error('scry 500'),
        reason: 'the channel could not be re-read (scry 500)',
      },
    ];
    for (const testCase of cases) {
      const context = makeReadContext({
        channelStates: [
          { joined: true, groupId: GROUP, order: [] },
          testCase.state,
        ],
        unreads: [NONE],
      });

      expect(await run(['mark-read', NEST], context.deps)).toBe(1);
      expect(context.stderr()).toBe(
        `Error: Mark read of channel ${NEST} was sent but is not confirmed: ${testCase.reason}. ${RERUN}\n`
      );
    }
  });
});

describe('activity mark-read --all', () => {
  const NOTEBOOK = 'notes/~zod/blog';
  const snapshot = unreads([
    channelSummary(NEST, 3),
    channelSummary(NOTEBOOK, 1),
    channelSummary('chat/~zod/quiet', 0),
    dmSummary(AUTHOR, 2),
    dmSummary(CLUB, 1),
    groupSummary(GROUP, 4),
  ]);

  it('counts every cleared source by kind', async () => {
    const context = makeReadContext({ unreads: [snapshot, NONE] });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked all read for ${ACTING}\n  Cleared: 2 channels, 1 DM, 1 group DM, 1 group\n  In the app: ${ALL_WHERE}\n`
    );
    expect(context.calls.sleeps).toEqual([]);
  });

  it('reports no reported unreads when the snapshot was clear', async () => {
    const context = makeReadContext({
      unreads: [unreads([channelSummary(NEST, 0)]), NONE],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked all read for ${ACTING} (no reported unreads)\n  In the app: ${ALL_WHERE}\n`
    );
    expect(context.calls.marks).toEqual([{ kind: 'all' }]);
  });

  it('lists new activity apart from what it cleared when acked', async () => {
    const context = makeReadContext({
      unreads: [
        snapshot,
        unreads([
          channelSummary(NEST, 2, 2),
          channelSummary('chat/~zod/quiet', 1, 3),
          dmSummary('~nec', 1, 4),
        ]),
      ],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Marked all read for ${ACTING}`,
        '  Cleared: 1 channel, 1 DM, 1 group DM, 1 group',
        '  New activity arrived after the read in 3 sources:',
        `    channel ${NEST}: 2 unreads`,
        '    channel chat/~zod/quiet: 1 unread',
        '    DM with ~nec: 1 unread',
        `  In the app: ${ALL_WHERE}`,
        '',
      ].join('\n')
    );
  });

  it('reports a residual source with unchanged recency as unconfirmed', async () => {
    const context = makeReadContext({
      unreads: [
        snapshot,
        unreads([channelSummary(NEST, 3), dmSummary(AUTHOR, 1)]),
      ],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: 2 sources still show unreads: channel ${NEST} (3 unreads), DM with ${AUTHOR} (1 unread). ${RERUN}\n`
    );
    expect(context.calls.sleeps).toEqual([500, 500, 500, 500]);
  });

  it('reports a mix of cleared, new and unconfirmed sources as unconfirmed', async () => {
    const context = makeReadContext({
      poke: { kind: 'ambiguous', message: 'Poke ack timed out after 30000ms' },
      unreads: [
        snapshot,
        unreads([channelSummary(NEST, 3, 2), groupSummary(GROUP, 4)]),
      ],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: 2 sources still show unreads: channel ${NEST} (3 unreads), group ${GROUP} (4 unreads). ${RERUN} (poke error: Poke ack timed out after 30000ms)\n`
    );
  });

  it('names only the unchanged residual when an acked read also shows new activity', async () => {
    const context = makeReadContext({
      unreads: [
        snapshot,
        unreads([channelSummary(NEST, 3, 2), groupSummary(GROUP, 4)]),
      ],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: 1 source still shows unreads: group ${GROUP} (4 unreads). ${RERUN}\n`
    );
  });

  it('separates cleared sources from new activity once an acked mix settles', async () => {
    const mixed = unreads([channelSummary(NEST, 3, 2), groupSummary(GROUP, 4)]);
    const context = makeReadContext({
      unreads: [snapshot, mixed, mixed, unreads([channelSummary(NEST, 3, 2)])],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      [
        `✓ Marked all read for ${ACTING}`,
        '  Cleared: 1 channel, 1 DM, 1 group DM, 1 group',
        '  New activity arrived after the read in 1 source:',
        `    channel ${NEST}: 3 unreads`,
        `  In the app: ${ALL_WHERE}`,
        '',
      ].join('\n')
    );
    expect(context.calls.sleeps).toEqual([500, 500]);
  });

  it('keeps an unacknowledged read of an empty snapshot unconfirmed', async () => {
    const context = makeReadContext({
      poke: { kind: 'ambiguous', message: 'Channel was reaped' },
      unreads: [unreads([channelSummary(NEST, 0)]), NONE],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stdout()).toBe('');
    expect(context.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: the read was not acknowledged and summaries cannot show thread-only unreads. ${RERUN} (poke error: Channel was reaped)\n`
    );
    expect(context.calls.unreadReads).toBe(2);
    expect(context.calls.sleeps).toEqual([]);
  });

  it('keeps a late source unconfirmed while the poke is ambiguous, and an empty snapshot unconfirmed once it clears', async () => {
    const context = makeReadContext({
      poke: { kind: 'ambiguous', message: 'Channel was reaped' },
      unreads: [NONE, unreads([dmSummary(AUTHOR, 1, 9)]), NONE],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: the read was not acknowledged and summaries cannot show thread-only unreads. ${RERUN} (poke error: Channel was reaped)\n`
    );
    expect(context.calls.sleeps).toEqual([500]);
  });

  it('confirms an unacknowledged read whose visible unreads all cleared', async () => {
    const context = makeReadContext({
      poke: { kind: 'ambiguous', message: 'Channel was reaped' },
      unreads: [snapshot, NONE],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(0);
    expect(context.stdout()).toBe(
      `✓ Marked all read for ${ACTING}\n  Cleared: 2 channels, 1 DM, 1 group DM, 1 group\n  In the app: ${ALL_WHERE}\n`
    );
  });

  it('keeps a persistent residual unconfirmed after five reads', async () => {
    const context = makeReadContext({
      unreads: [unreads([groupSummary(GROUP, 4, 3)])],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: 1 source still shows unreads: group ${GROUP} (4 unreads). ${RERUN}\n`
    );
    expect(context.calls.unreadReads).toBe(6);
  });

  it('confirms when the last source clears on the fifth read', async () => {
    const stale = unreads([groupSummary(GROUP, 4)]);
    const context = makeReadContext({
      unreads: [stale, stale, stale, stale, stale, NONE],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(0);
    expect(context.calls.unreadReads).toBe(6);
    expect(context.calls.sleeps).toEqual([500, 500, 500, 500]);
  });

  it('reports a read-back failure as unconfirmed', async () => {
    const context = makeReadContext({
      unreads: [snapshot, new Error('scry 500')],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: the unreads could not be read. ${RERUN} (last read error: scry 500)\n`
    );
  });

  it('names at most 20 residual sources', async () => {
    const residual = (count: number) =>
      unreads(
        Array.from({ length: count }, (_, i) =>
          channelSummary(`chat/~zod/c${i}`, 1)
        )
      );
    const names = (count: number) =>
      Array.from(
        { length: count },
        (_, i) => `channel chat/~zod/c${i} (1 unread)`
      ).join(', ');

    const twenty = makeReadContext({ unreads: [residual(20)] });
    expect(await run(['mark-read', '--all'], twenty.deps)).toBe(1);
    expect(twenty.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: 20 sources still show unreads: ${names(20)}. ${RERUN}\n`
    );

    const twentyOne = makeReadContext({ unreads: [residual(21)] });
    expect(await run(['mark-read', '--all'], twentyOne.deps)).toBe(1);
    expect(twentyOne.stderr()).toBe(
      `Error: Mark all read was sent but is not confirmed: 21 sources still show unreads: ${names(20)}, and 1 more. ${RERUN}\n`
    );
  });

  it('names at most 20 sources with new activity', async () => {
    const fresh = unreads(
      Array.from({ length: 21 }, (_, i) =>
        channelSummary(`chat/~zod/c${i}`, 1, 2)
      )
    );
    const context = makeReadContext({ unreads: [NONE, fresh] });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(0);
    const lines = context.stdout().split('\n');
    expect(lines[1]).toBe(
      '  New activity arrived after the read in 21 sources:'
    );
    expect(lines[21]).toBe('    channel chat/~zod/c19: 1 unread');
    expect(lines[22]).toBe('    and 1 more');
  });

  it('reports a nack without reading back', async () => {
    const context = makeReadContext({
      poke: { kind: 'nacked', message: 'bail: %activity crashed' },
      unreads: [snapshot],
    });

    expect(await run(['mark-read', '--all'], context.deps)).toBe(1);
    expect(context.stderr()).toBe(
      'Error: Could not mark everything read: bail: %activity crashed\n'
    );
    expect(context.calls.unreadReads).toBe(1);
  });
});

describe('activity mark-read: arguments', () => {
  const help = ACTIVITY_COMMAND_HELP['mark-read'];
  const unrecognized = (raw: string) =>
    `Unrecognized target: ${raw}. Use ~ship, a group-DM id (0v...), ~host/group, chat/~host/name or heap/~host/name`;
  const usageCases: Array<{ args: string[]; message: string | null }> = [
    { args: [], message: null },
    { args: ['--self'], message: null },
    {
      args: [NEST, ROOT_ID],
      message: `Unexpected argument: ${ROOT_ID}. ${MARK_READ_POST_ID_MESSAGE}`,
    },
    {
      args: [AUTHOR, ROOT_ID],
      message: `Unexpected argument: ${ROOT_ID}. ${MARK_READ_POST_ID_MESSAGE}`,
    },
    { args: ['--all', GROUP], message: MARK_READ_ALL_WITH_TARGET },
    { args: [GROUP, '--all'], message: MARK_READ_ALL_WITH_TARGET },
    { args: ['--force'], message: 'Unknown option: --force' },
    { args: [GROUP, '--invites'], message: 'Unknown option: --invites' },
    { args: ['base'], message: unrecognized('base') },
    { args: ['a/b/c/d'], message: unrecognized('a/b/c/d') },
    {
      args: ['~foo'],
      message: 'Invalid ship: ~foo (expected a ship such as ~sampel-palnet)',
    },
    {
      args: ['0v4.abc'],
      message:
        'Invalid group-DM id: 0v4.abc (expected a 0v... id such as 0v1f.abcde)',
    },
  ];

  for (const testCase of usageCases) {
    it(`rejects mark-read ${testCase.args.join(' ')} before authenticating`, async () => {
      const context = makeReadContext();

      expect(await run(['mark-read', ...testCase.args], context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(
        testCase.message === null
          ? `${help}\n`
          : `Error: ${testCase.message}\n\n${help}\n`
      );
      expect(context.calls.authenticate).toBe(0);
      expect(context.calls.marks).toEqual([]);
    });
  }

  const refusals: Array<{ target: string; message: string }> = [
    { target: 'notes/~zod/blog', message: NOTES_MARK_READ_REFUSAL },
    { target: 'diary/~zod/blog', message: DIARY_REMOVED },
  ];

  for (const testCase of refusals) {
    it(`refuses mark-read ${testCase.target} locally`, async () => {
      const context = makeReadContext();

      expect(await run(['mark-read', testCase.target], context.deps)).toBe(1);
      expect(context.stdout()).toBe('');
      expect(context.stderr()).toBe(`Error: ${testCase.message}\n`);
      expect(context.calls.authenticate).toBe(0);
    });
  }

  it('prints mark-read help without authenticating', async () => {
    for (const args of [
      ['mark-read', '--help'],
      ['mark-read', AUTHOR, '-h'],
    ]) {
      const context = makeReadContext();
      expect(await run(args, context.deps)).toBe(0);
      expect(context.stdout()).toBe(`${help}\n`);
      expect(context.calls.authenticate).toBe(0);
    }
  });
});
