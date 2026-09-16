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
      let refreshSettingsNow;
      ${callback('refreshSettingsNow = async (): Promise<void> =>')}
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

describe('group-channel refresh after a subscription gap', () => {
  const kept = 'chat/~zod/kept';
  const changed = 'chat/~zod/changed';
  const joined = 'chat/~zod/joined';

  it.each([
    { change: 'removal', before: [kept, changed], after: [kept] },
    { change: 'addition', before: [kept], after: [kept, changed] },
  ])(
    'preserves an owner $change when the next fresh snapshot is unchanged',
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
      expect(monitor.current.groupChannels).toEqual(after);

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
