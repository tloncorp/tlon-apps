import { readFileSync } from 'node:fs';
import { compileFunction } from 'node:vm';
import { transformWithOxc } from 'vite';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type TlonSettingsStore,
  applySettingsUpdate,
  createSettingsManager,
} from '../settings.js';
import {
  type GroupChannelJournal,
  createGroupChannelJournal,
} from './group-channels.js';

type MonitorDeps = {
  groupChannelJournal: GroupChannelJournal;
  settingsManager: ReturnType<typeof createSettingsManager>;
  applySettingsUpdate: typeof applySettingsUpdate;
  runtime: { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
};
type Monitor = {
  refresh(): Promise<void>;
  readonly current: TlonSettingsStore;
  readonly watched: Set<string>;
};
let makeMonitor: (deps: MonitorDeps) => Monitor;

beforeAll(async () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const callback = (marker: string) => {
    const start = source.indexOf(marker);
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('\n      };', start);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end + '\n      };'.length);
  };

  // Execute the actual monitor callbacks: a copied refresh implementation or
  // source-order assertion would miss interactions with snapshot equality.
  // Only unrelated nudge and authorization dependencies are stubbed.
  const { code } = await transformWithOxc(
    `
    function createMonitor(deps) {
      const { groupChannelJournal, settingsManager, applySettingsUpdate, runtime } = deps;
      let currentSettings = settingsManager.current;
      const pendingNudgeRehydrated = true;
      const getPendingNudge = () => undefined;
      const account = { accountId: 'test', groupInviteAllowlist: [] };
      let effectiveGroupInviteAllowlist = [];
      let effectiveAutoDiscoverChannels = false;
      const resolveSettingsMirrorSync = () => ({});
      const watchedChannels = new Set(currentSettings.groupChannels ?? []);
      const scanDiscoveredAgentOnboardingNest = async () => {};
      const capturePluginError = () => {};
      ${callback('const applySettingsSnapshot = (')}
      let settingsRefreshInFlight = null;
      let refreshSettingsNow;
      ${callback('refreshSettingsNow = async (): Promise<void> =>')}
      settingsManager.onChange((settings) => applySettingsSnapshot(settings, 'subscription'));
      return {
        refresh: refreshSettingsNow,
        get current() { return currentSettings; },
        get watched() { return watchedChannels; },
      };
    }
    `,
    'group-channel-refresh.ts',
    { lang: 'ts', target: 'es2022' }
  );
  makeMonitor = compileFunction(`${code}\nreturn createMonitor(deps);`, [
    'deps',
  ]) as typeof makeMonitor;
});

describe('group-channel refresh single-flight', () => {
  it('serves concurrent refresh callers with one scry', async () => {
    let release!: () => void;
    const held = new Promise<unknown>((resolve) => {
      release = () =>
        resolve({ all: { moltbot: { tlon: { groupChannels: [] } } } });
    });
    const scry = vi.fn(() => held);
    const settingsManager = createSettingsManager({
      scry,
      subscribe: async () => {},
    } as never);
    const journal = createGroupChannelJournal({
      initial: [],
      trusted: true,
      protectedNests: () => new Set(),
      putEntry: async () => undefined,
    });
    const monitor = makeMonitor({
      groupChannelJournal: journal,
      settingsManager,
      applySettingsUpdate,
      runtime: { log: vi.fn(), error: vi.fn() },
    });

    // The discovery poll and the settings timer coinciding: both callers
    // must share the in-flight scry, or the older result could supersede
    // the newer one.
    const first = monitor.refresh();
    const second = monitor.refresh();
    expect(scry).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(scry).toHaveBeenCalledTimes(1);

    // A later caller starts a new scry.
    await monitor.refresh();
    expect(scry).toHaveBeenCalledTimes(2);
  });
});

describe('group-channel refresh superseded by a same-valued fact', () => {
  it('does not trust a scry that an operator restore overtook', async () => {
    const kept = 'chat/~zod/kept';
    const stale = 'chat/~zod/stale';
    const joined = 'chat/~zod/joined';
    const snapshot = (groupChannels: string[]) => ({
      all: { moltbot: { tlon: { groupChannels } } },
    });
    let response:
      | ReturnType<typeof snapshot>
      | Promise<ReturnType<typeof snapshot>> = snapshot([kept]);
    let emit!: (event: unknown) => void;
    const settingsManager = createSettingsManager({
      scry: () => Promise.resolve(response),
      subscribe: async (params: { event: typeof emit }) => {
        emit = params.event;
      },
    } as never);
    await settingsManager.load();
    await settingsManager.startSubscription();

    const putEntry = vi.fn(async (_value: string[]) => undefined);
    const journal = createGroupChannelJournal({
      initial: settingsManager.current.groupChannels,
      trusted: true,
      protectedNests: () => new Set(),
      putEntry,
    });
    const monitor = makeMonitor({
      groupChannelJournal: journal,
      settingsManager,
      applySettingsUpdate,
      runtime: { log: vi.fn(), error: vi.fn() },
    });

    // The ship changed to [kept, stale] while no echo could reach us; this
    // scry captures that, and while it is in flight an operator restores
    // [kept], the value the journal last observed.
    let resolve!: (value: ReturnType<typeof snapshot>) => void;
    response = new Promise((done) => {
      resolve = done;
    });
    const refresh = monitor.refresh();
    emit({
      'put-entry': {
        desk: 'moltbot',
        'bucket-key': 'tlon',
        'entry-key': 'groupChannels',
        value: [kept],
      },
    });
    resolve(snapshot([kept, stale]));
    await refresh;

    // The same-valued fact superseded the scry: the stale value is neither
    // installed nor trusted as the write base.
    expect(settingsManager.current.groupChannels).toEqual([kept]);
    expect(monitor.current.groupChannels).toEqual([kept]);
    await journal.persist([joined]);
    expect(putEntry).toHaveBeenCalledExactlyOnceWith([kept, joined].sort());
  });
});

describe('group-channel refresh after a subscription gap', () => {
  const kept = 'chat/~zod/kept';
  const changed = 'chat/~zod/changed';
  const joined = 'chat/~zod/joined';

  it('does not re-trust a gapped refresh through an unrelated settings fact', async () => {
    const snapshot = (groupChannels: string[]) => ({
      all: { moltbot: { tlon: { groupChannels } } },
    });
    let response:
      | ReturnType<typeof snapshot>
      | Promise<ReturnType<typeof snapshot>> = snapshot([kept]);
    let emit!: (event: unknown) => void;
    const settingsManager = createSettingsManager({
      scry: () => Promise.resolve(response),
      subscribe: async (params: { event: typeof emit }) => {
        emit = params.event;
      },
    } as never);
    await settingsManager.load();
    await settingsManager.startSubscription();

    const putEntry = vi.fn(async (_value: string[]) => undefined);
    const journal = createGroupChannelJournal({
      initial: [kept],
      trusted: true,
      protectedNests: () => new Set(),
      putEntry,
    });
    const runtime = { log: vi.fn(), error: vi.fn() };
    const monitor = makeMonitor({
      groupChannelJournal: journal,
      settingsManager,
      applySettingsUpdate,
      runtime,
    });

    let resolve!: (value: ReturnType<typeof snapshot>) => void;
    response = new Promise((done) => {
      resolve = done;
    });
    const interruptedRefresh = monitor.refresh();
    journal.markUntrusted();
    // This scry captured a channel that the owner removed during the gap.
    resolve(snapshot([kept, changed]));
    await interruptedRefresh;
    expect(journal.trusted).toBe(false);

    emit({
      'put-entry': {
        desk: 'moltbot',
        'bucket-key': 'tlon',
        'entry-key': 'autoDiscoverChannels',
        value: false,
      },
    });
    expect(journal.trusted).toBe(false);
    expect(settingsManager.current.groupChannels).toEqual([kept]);
    expect(monitor.current.autoDiscoverChannels).toBe(false);
    await journal.persist([joined]);
    expect(putEntry).not.toHaveBeenCalled();

    response = snapshot([kept]);
    await monitor.refresh();
    await journal.flush();
    expect(runtime.error).not.toHaveBeenCalled();
    expect(journal.trusted).toBe(true);
    expect(putEntry).toHaveBeenCalledExactlyOnceWith([kept, joined].sort());
  });

  it.each([
    { change: 'removal', before: [kept, changed], after: [kept] },
    { change: 'addition', before: [kept], after: [kept, changed] },
  ])(
    'preserves an owner $change when the next scry repeats the interrupted snapshot',
    async ({ before, after }) => {
      const snapshot = (groupChannels: string[]) => ({
        all: { moltbot: { tlon: { groupChannels } } },
      });
      let response:
        | ReturnType<typeof snapshot>
        | Promise<ReturnType<typeof snapshot>> = snapshot(before);
      const settingsManager = createSettingsManager({
        scry: () => Promise.resolve(response),
      } as never);
      await settingsManager.load();

      const putEntry = vi.fn(async (_value: string[]) => undefined);
      const journal = createGroupChannelJournal({
        initial: before,
        trusted: true,
        protectedNests: () => new Set(),
        putEntry,
      });
      const runtime = { log: vi.fn(), error: vi.fn() };
      const monitor = makeMonitor({
        groupChannelJournal: journal,
        settingsManager,
        applySettingsUpdate,
        runtime,
      });

      let resolve!: (value: ReturnType<typeof snapshot>) => void;
      response = new Promise((done) => {
        resolve = done;
      });
      const interruptedRefresh = monitor.refresh();
      journal.markUntrusted();
      resolve(snapshot(after));
      await interruptedRefresh;
      expect(journal.trusted).toBe(false);
      expect(journal.lastObserved).toEqual(before);
      expect(monitor.current.groupChannels).toEqual(before);

      response = snapshot(after);
      await monitor.refresh();
      expect(runtime.error).not.toHaveBeenCalled();
      expect(journal.trusted).toBe(true);
      expect(journal.lastObserved).toEqual(after);
      expect([...monitor.watched].sort()).toEqual([...after].sort());

      await journal.persist([joined]);
      expect(putEntry).toHaveBeenCalledExactlyOnceWith(
        [...after, joined].sort()
      );
    }
  );
});
