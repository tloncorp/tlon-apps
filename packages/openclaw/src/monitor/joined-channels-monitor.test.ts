import { readFileSync } from 'node:fs';
import { compileFunction } from 'node:vm';
import { transformWithOxc } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { isDmNest } from '../targets.js';
import {
  type JoinedChannels,
  createJoinedChannels,
} from './joined-channels.js';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

/** A closure-scope arrow function of the monitor, by its declaration marker. */
const sliceFrom = (marker: string) => {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n    };', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + '\n    };'.length);
};

/** A closure-scope single-expression arrow function of the monitor. */
const sliceStatement = (marker: string) => {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf(';\n', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + 1);
};

type Deps = {
  watchedChannels: Set<string>;
  joinedChannels: JoinedChannels;
  clearAgentOnboardingRetry: ReturnType<typeof vi.fn>;
  onboardingCatchUp: {
    reconcile: ReturnType<typeof vi.fn>;
    schedule: ReturnType<typeof vi.fn>;
  };
  processedTracker: { mark: ReturnType<typeof vi.fn> };
  scanAgentOnboardingChannel: ReturnType<typeof vi.fn>;
  fetchInitData: ReturnType<typeof vi.fn>;
  runtime: { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
};
type Monitor = {
  handleChannelsFirehose(event: unknown): Promise<void>;
  scanAgentOnboardingNest(nest: string): Promise<boolean | undefined>;
  rescanRecentlyJoinedChannels(): Promise<void>;
  syncJoinedChannels(): Promise<unknown>;
  onboardingDiscoveryFlights: Set<Promise<boolean | undefined>>;
  startDrainingOnboardingDiscovery(): void;
};
let makeMonitor: (deps: Deps & { isDmNest: typeof isDmNest }) => Monitor;

beforeAll(async () => {
  // Execute the real monitor callbacks. Only the paths these tests reach
  // need their dependencies stubbed.
  const { code } = await transformWithOxc(
    `
    function createMonitor(deps) {
      const {
        watchedChannels, joinedChannels, clearAgentOnboardingRetry,
        onboardingCatchUp, processedTracker, scanAgentOnboardingChannel,
        fetchInitData, runtime, isDmNest,
      } = deps;
      const opts = {};
      const account = { accountId: 'test' };
      const api = {};
      const botShipName = '~bot';
      const effectiveOwnerShip = '~owner';
      const channelToGroup = new Map([['chat/~zod/general', '~zod/test']]);
      const computingPresence = {};
      const getBotProfile = () => undefined;
      const trackOnboardingStep = () => () => {};
      const randomUUID = () => 'uuid';
      const createAgentOnboardingReconciliationPresence = () => ({});
      const onboardingDiscoveryFlights = new Set();
      let drainingOnboardingDiscovery = false;
      ${sliceStatement('const unwatchedByLeave =')}
      ${sliceFrom('const rewatchAfterRejoin =')}
      ${sliceFrom('const syncJoinedChannels = async')}
      ${sliceFrom('const scanAgentOnboardingNest = async')}
      ${sliceFrom('const handleChannelsFirehose = async')}
      ${sliceFrom('const runOnboardingDiscoveryFlight = async')}
      ${sliceStatement('const scanDiscoveredAgentOnboardingNest =')}
      ${sliceFrom('const rescanRecentlyJoinedChannels = async')}
      return {
        handleChannelsFirehose,
        scanAgentOnboardingNest,
        rescanRecentlyJoinedChannels,
        syncJoinedChannels,
        onboardingDiscoveryFlights,
        startDrainingOnboardingDiscovery: () => {
          drainingOnboardingDiscovery = true;
        },
      };
    }
    `,
    'joined-channels-monitor.ts',
    { lang: 'ts', target: 'es2022' }
  );
  makeMonitor = compileFunction(`${code}\nreturn createMonitor(deps);`, [
    'deps',
  ]) as typeof makeMonitor;
});

const general = 'chat/~zod/general';

function setup(options: {
  watched?: string[];
  joined?: string[] | null;
  now?: () => number;
}) {
  const joinedChannels = createJoinedChannels({ now: options.now });
  if (options.joined !== null) {
    joinedChannels.applySync(
      joinedChannels.beginSync(),
      new Set(options.joined ?? [])
    );
  }
  const deps: Deps = {
    watchedChannels: new Set(options.watched ?? []),
    joinedChannels,
    clearAgentOnboardingRetry: vi.fn(),
    onboardingCatchUp: {
      reconcile: vi.fn(async () => true),
      schedule: vi.fn(),
    },
    // Refusing the message ends the handler at its first step.
    processedTracker: { mark: vi.fn(() => false) },
    scanAgentOnboardingChannel: vi.fn(async () => true),
    fetchInitData: vi.fn(async () => ({ joinedChannels: null })),
    runtime: { log: vi.fn(), error: vi.fn() },
  };
  return { deps, monitor: makeMonitor({ ...deps, isDmNest }) };
}

const post = (nest: string) => ({
  nest,
  response: {
    post: {
      id: '170141184507000000000000000000000000',
      'r-post': {
        set: { essay: { author: '~nec', content: [], sent: 1 } },
      },
    },
  },
});

describe('channel firehose with a joined set', () => {
  it.each([
    { case: 'a watched', watched: [general] },
    { case: 'an unwatched', watched: [] },
  ])(
    'unwatches $case nest on leave without auto-watching it',
    async ({ watched }) => {
      const { deps, monitor } = setup({ watched, joined: [general] });

      await monitor.handleChannelsFirehose({
        nest: general,
        response: { leave: null },
      });

      expect(deps.watchedChannels.has(general)).toBe(false);
      expect(deps.clearAgentOnboardingRetry).toHaveBeenCalledWith(general);
      expect(deps.onboardingCatchUp.reconcile).not.toHaveBeenCalled();
      expect(deps.processedTracker.mark).not.toHaveBeenCalled();
    }
  );

  it('still watches and handles a post the joined set says is not joined', async () => {
    const { deps, monitor } = setup({ joined: [] });

    await monitor.handleChannelsFirehose(post(general));

    expect(deps.watchedChannels.has(general)).toBe(true);
    expect(deps.onboardingCatchUp.reconcile).toHaveBeenCalledWith(general);
    expect(deps.processedTracker.mark).toHaveBeenCalledOnce();
  });

  it('reconciles a watched nest once when it becomes joined', async () => {
    const { deps, monitor } = setup({ watched: [general], joined: [] });
    const joinFact = { nest: general, response: { join: '~zod/test' } };

    await monitor.handleChannelsFirehose(joinFact);
    await monitor.handleChannelsFirehose(joinFact);

    expect(deps.onboardingCatchUp.reconcile).toHaveBeenCalledExactlyOnceWith(
      general
    );
  });
});

describe('a leave racing a join', () => {
  it('stays unwatched when the leave lands during the join reconcile', async () => {
    const { deps, monitor } = setup({ watched: [general], joined: [] });
    let finish!: (reconciled: boolean) => void;
    deps.onboardingCatchUp.reconcile.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finish = resolve))
    );

    const joining = monitor.handleChannelsFirehose({
      nest: general,
      response: { join: '~zod/test' },
    });
    await vi.waitFor(() =>
      expect(deps.onboardingCatchUp.reconcile).toHaveBeenCalledOnce()
    );
    await monitor.handleChannelsFirehose({
      nest: general,
      response: { leave: null },
    });
    finish(true);
    await joining;

    expect(deps.watchedChannels.has(general)).toBe(false);
  });
});

describe('re-watching a channel after rejoin', () => {
  const leftGeneral = async (time = { now: 1_000_000 }) => {
    const ctx = setup({
      watched: [general],
      joined: [general],
      now: () => time.now,
    });
    await ctx.monitor.handleChannelsFirehose({
      nest: general,
      response: { leave: null },
    });
    expect(ctx.deps.watchedChannels.has(general)).toBe(false);
    return ctx;
  };

  it('re-watches and rescans a left nest a later snapshot shows joined', async () => {
    const { deps, monitor } = await leftGeneral();
    // The rejoin's join fact was missed.
    deps.fetchInitData.mockResolvedValueOnce({
      joinedChannels: new Set([general]),
    });

    await monitor.syncJoinedChannels();
    expect(deps.watchedChannels.has(general)).toBe(true);

    await monitor.rescanRecentlyJoinedChannels();
    expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledWith(
      expect.objectContaining({ channelNest: general })
    );
  });

  it('does not watch a nest it never unwatched when a snapshot shows it', async () => {
    const { deps, monitor } = setup({ joined: [general] });
    await monitor.handleChannelsFirehose({
      nest: general,
      response: { leave: null },
    });
    deps.fetchInitData.mockResolvedValueOnce({
      joinedChannels: new Set([general]),
    });

    await monitor.syncJoinedChannels();
    expect(deps.watchedChannels.has(general)).toBe(false);
  });
});

describe('poll re-scan of recently joined channels', () => {
  const recentlyJoined = (time: { now: number }) => {
    const { deps, monitor } = setup({
      watched: [general, 'heap/~zod/links'],
      joined: [],
      now: () => time.now,
    });
    // Missed join fact: only the poll's snapshot shows the nests.
    deps.joinedChannels.applySync(
      deps.joinedChannels.beginSync(),
      new Set([general, 'heap/~zod/links', 'chat/~zod/unwatched'])
    );
    return { deps, monitor };
  };

  it('reads each watched chat nest joined within the window once per tick', async () => {
    const time = { now: 1_000_000 };
    const { deps, monitor } = recentlyJoined(time);

    await monitor.rescanRecentlyJoinedChannels();
    expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledOnce();
    expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledWith(
      expect.objectContaining({ channelNest: general })
    );

    await monitor.rescanRecentlyJoinedChannels();
    expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledTimes(2);

    time.now += 10 * 60_000 + 1;
    await monitor.rescanRecentlyJoinedChannels();
    expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledTimes(2);
    // No catch-up window: the next tick is the repeat.
    expect(deps.onboardingCatchUp.reconcile).not.toHaveBeenCalled();
    expect(deps.onboardingCatchUp.schedule).not.toHaveBeenCalled();
  });

  it('holds its scan in the drained flight set and skips once draining', async () => {
    const { deps, monitor } = recentlyJoined({ now: 1_000_000 });
    let finish!: (reconciled: boolean) => void;
    deps.scanAgentOnboardingChannel.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finish = resolve))
    );

    const tick = monitor.rescanRecentlyJoinedChannels();
    await vi.waitFor(() =>
      expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledOnce()
    );
    expect(monitor.onboardingDiscoveryFlights.size).toBe(1);
    finish(true);
    await tick;
    expect(monitor.onboardingDiscoveryFlights.size).toBe(0);

    monitor.startDrainingOnboardingDiscovery();
    await monitor.rescanRecentlyJoinedChannels();
    expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledOnce();
  });
});

describe('onboarding scan with a joined set', () => {
  it('skips a watched nest known not to be joined and stops its retry', async () => {
    const { deps, monitor } = setup({ watched: [general], joined: [] });

    await expect(monitor.scanAgentOnboardingNest(general)).resolves.toBe(
      undefined
    );
    expect(deps.scanAgentOnboardingChannel).not.toHaveBeenCalled();
    expect(deps.clearAgentOnboardingRetry).toHaveBeenCalledWith(general);
  });

  it.each([
    { case: 'joined', joined: [general] },
    { case: 'unknown', joined: null },
  ])('scans a watched nest while it is $case', async ({ joined }) => {
    const { deps, monitor } = setup({ watched: [general], joined });

    await expect(monitor.scanAgentOnboardingNest(general)).resolves.toBe(true);
    expect(deps.scanAgentOnboardingChannel).toHaveBeenCalledOnce();
  });
});

describe('joined set wiring', () => {
  it('handles a leave before the firehose auto-watch', () => {
    const fn = sliceFrom('const handleChannelsFirehose = async');
    const left = fn.indexOf("joinChange === 'left'");
    expect(left).toBeGreaterThan(-1);
    expect(left).toBeLessThan(fn.indexOf('watchedChannels.add(nest)'));
  });

  it('checks the joined set before the scan reads anything', () => {
    const fn = sliceFrom('const scanAgentOnboardingNest = async');
    const guard = fn.indexOf('joinedChannels.isKnownNotJoined(nest)');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(fn.indexOf('await '));
  });

  it('syncs once the firehose is live, before the startup scans', () => {
    const connect = source.indexOf('await api.connect();');
    const sync = source.indexOf('await syncJoinedChannels();', connect);
    expect(connect).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(connect);
    expect(sync).toBeLessThan(source.indexOf('const startupOnboardingNests'));
  });

  it('syncs on every discovery poll tick, with discovery on or off', () => {
    expect(sliceFrom('const mergeDiscoveredChannels = async')).toContain(
      'await syncJoinedChannels();'
    );
    const tick = source.slice(source.indexOf('const pollInterval'));
    const discovery = tick.indexOf('if (effectiveAutoDiscoverChannels) {');
    const merge = tick.indexOf('await mergeDiscoveredChannels();');
    const otherwise = tick.indexOf('} else {', merge);
    expect(discovery).toBeGreaterThan(-1);
    expect(merge).toBeGreaterThan(discovery);
    expect(tick.slice(otherwise, tick.indexOf('} catch'))).toContain(
      'await syncJoinedChannels();'
    );
  });

  it('re-scans recent joins on every poll tick, with discovery on or off', () => {
    const tick = source.slice(source.indexOf('const pollInterval'));
    const merge = tick.indexOf('await mergeDiscoveredChannels();');
    const branchEnd = tick.indexOf('\n              }\n', merge);
    const rescan = tick.indexOf('await rescanRecentlyJoinedChannels();');
    expect(branchEnd).toBeGreaterThan(merge);
    expect(rescan).toBeGreaterThan(branchEnd);
    expect(rescan).toBeLessThan(tick.indexOf('} catch'));
  });
});
