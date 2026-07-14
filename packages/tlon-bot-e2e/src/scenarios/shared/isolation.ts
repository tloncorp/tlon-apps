import { sleep, waitFor } from '../../runtime/waiters.js';
import type { ScenarioActors } from './actors.js';

export const SETTINGS_DESK = 'moltbot';
export const SETTINGS_BUCKET = 'tlon';

export interface ScenarioIsolationOptions {
  ownerListenEnabled?: boolean;
  dmAllowlist?: readonly string[];
  groupChannels?: readonly string[];
}

export async function resetBaselineIsolation(
  actors: ScenarioActors,
  opts: ScenarioIsolationOptions = {}
): Promise<void> {
  const dmAllowlist = opts.dmAllowlist ?? [actors.owner.ship];
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'ownerListenEnabled',
    value: opts.ownerListenEnabled ?? true,
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'ownerListenDisabledChannels',
    value: [],
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'ownerListenEnabledChannels',
    value: [],
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'ownerListenDefault',
    value: 'owned',
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'groupChannels',
    value: [...(opts.groupChannels ?? [])],
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'dmAllowlist',
    value: [...dmAllowlist],
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'channelRules',
    value: '{}',
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'defaultAuthorizedShips',
    value: [],
  });
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'pendingApprovals',
    value: '[]',
  });
  await ensureShipUnblocked(actors, actors.thirdParty.ship);
  await waitForSettingsEntries(actors, {
    ownerListenEnabled: opts.ownerListenEnabled ?? true,
    ownerListenDisabledChannels: [],
    ownerListenEnabledChannels: [],
    ownerListenDefault: 'owned',
    groupChannels: [...(opts.groupChannels ?? [])],
    dmAllowlist: [...dmAllowlist],
    channelRules: '{}',
    defaultAuthorizedShips: [],
    pendingApprovals: '[]',
  });
  await sleep(750);
}

export async function withSettingsEntry(
  actors: ScenarioActors,
  key: string,
  value: unknown
): Promise<void> {
  const before = await settingsBucket(actors);
  const hadBefore = Object.prototype.hasOwnProperty.call(before, key);
  const previous = before[key];
  await actors.bot.setSettingsEntry({ bucket: SETTINGS_BUCKET, key, value });
  actors.bot.teardown(
    async () => {
      if (hadBefore) {
        await actors.bot.setSettingsEntry({
          bucket: SETTINGS_BUCKET,
          key,
          value: previous,
        });
      } else {
        await actors.bot.setSettingsEntry({
          bucket: SETTINGS_BUCKET,
          key,
          value: defaultSettingValue(key),
        });
      }
    },
    { kind: 'settings-rollback', label: `restore setting ${key}` }
  );
  await waitForSettingsEntries(actors, { [key]: value });
  await sleep(750);
}

export const NUDGE_SETTINGS_KEYS = [
  'nudgeActiveHoursStart',
  'nudgeActiveHoursEnd',
  'lastOwnerMessageAt',
  'lastOwnerMessageDate',
  'lastNudgeStage',
  'pendingNudge',
] as const;

type NudgeSettingsKey = (typeof NUDGE_SETTINGS_KEYS)[number];

export interface NudgeSettingsIsolation {
  set(key: NudgeSettingsKey, value: unknown): Promise<void>;
  delete(key: NudgeSettingsKey): Promise<void>;
  confirmClosedWindow(): void;
}

export async function withNudgeSettingsIsolation(
  actors: ScenarioActors
): Promise<NudgeSettingsIsolation> {
  const snapshot = await settingsBucket(actors);
  const changed = new Set<NudgeSettingsKey>();
  let closedWindowConfirmed = false;

  async function restore(key: NudgeSettingsKey): Promise<void> {
    if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
      await actors.bot.setSettingsEntry({
        bucket: SETTINGS_BUCKET,
        key,
        value: snapshot[key],
      });
    } else {
      await actors.bot.deleteSettingsEntry({ bucket: SETTINGS_BUCKET, key });
    }
  }

  actors.bot.teardown(
    async () => {
      const changedKeys = [...changed];
      const teardownChanged = new Set<NudgeSettingsKey>();
      // A fresh-activity sentinel alone is not enough to make this safe: if
      // setup failed before the equal bounds were established, forcing only
      // end=00:00 could open the default 09:00–00:00 wrap-around window.
      if (closedWindowConfirmed) {
        await actors.bot.setSettingsEntry({
          bucket: SETTINGS_BUCKET,
          key: 'nudgeActiveHoursEnd',
          value: '00:00',
        });
        teardownChanged.add('nudgeActiveHoursEnd');
        await waitForSettingsEntries(actors, { nudgeActiveHoursEnd: '00:00' });
      }
      for (const key of [
        'pendingNudge',
        'lastNudgeStage',
        'lastOwnerMessageAt',
        'lastOwnerMessageDate',
      ] as const) {
        if (changed.has(key)) {
          await restore(key);
        }
      }
      for (const key of [
        'nudgeActiveHoursStart',
        'nudgeActiveHoursEnd',
      ] as const) {
        if (changed.has(key) || teardownChanged.has(key)) {
          await restore(key);
        }
      }
      if (!closedWindowConfirmed) {
        for (const key of changedKeys) {
          if (
            key !== 'pendingNudge' &&
            key !== 'lastNudgeStage' &&
            key !== 'lastOwnerMessageAt' &&
            key !== 'lastOwnerMessageDate' &&
            key !== 'nudgeActiveHoursStart' &&
            key !== 'nudgeActiveHoursEnd'
          ) {
            await restore(key);
          }
        }
      }
    },
    { kind: 'settings-rollback', label: 'restore nudge settings batch' }
  );

  return {
    async set(key, value) {
      changed.add(key);
      await actors.bot.setSettingsEntry({ bucket: SETTINGS_BUCKET, key, value });
    },
    async delete(key) {
      changed.add(key);
      await actors.bot.deleteSettingsEntry({ bucket: SETTINGS_BUCKET, key });
    },
    confirmClosedWindow() {
      closedWindowConfirmed = true;
    },
  };
}

export async function allowDmFrom(
  actors: ScenarioActors,
  ship: string
): Promise<void> {
  const bucket = await settingsBucket(actors);
  const current = Array.isArray(bucket.dmAllowlist)
    ? bucket.dmAllowlist.map(String)
    : [actors.owner.ship];
  const next = current.includes(ship) ? current : [...current, ship];
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'dmAllowlist',
    value: next,
  });
  actors.bot.teardown(
    async () => {
      await actors.bot.setSettingsEntry({
        bucket: SETTINGS_BUCKET,
        key: 'dmAllowlist',
        value: [actors.owner.ship],
      });
    },
    { kind: 'settings-rollback', label: 'restore dmAllowlist' }
  );
  await waitForSettingsEntries(actors, { dmAllowlist: next });
  await sleep(750);
}

export async function monitorGroupChannels(
  actors: ScenarioActors,
  channels: readonly string[]
): Promise<void> {
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'groupChannels',
    value: [...channels],
  });
  actors.bot.teardown(
    async () => {
      await actors.bot.setSettingsEntry({
        bucket: SETTINGS_BUCKET,
        key: 'groupChannels',
        value: [],
      });
    },
    { kind: 'settings-rollback', label: 'restore groupChannels' }
  );
  await waitForSettingsEntries(actors, { groupChannels: [...channels] });
  await sleep(750);
}

export async function clearPendingApprovals(
  actors: ScenarioActors
): Promise<void> {
  await actors.bot.setSettingsEntry({
    bucket: SETTINGS_BUCKET,
    key: 'pendingApprovals',
    value: '[]',
  });
  await waitForSettingsEntries(actors, { pendingApprovals: '[]' });
}

export async function settingsBucket(
  actors: ScenarioActors
): Promise<Record<string, unknown>> {
  return actors.bot.state.settingsBucket(SETTINGS_DESK, SETTINGS_BUCKET);
}

export async function waitForSettingsEntries(
  actors: ScenarioActors,
  expected: Record<string, unknown>
): Promise<void> {
  await waitFor(
    async () => {
      const bucket = await settingsBucket(actors);
      return Object.entries(expected).every(([key, value]) =>
        settingsValueEqual(bucket[key], value)
      );
    },
    {
      timeoutMs: 8_000,
      intervalMs: 500,
      description: `settings entries ${Object.keys(expected).join(', ')}`,
    }
  );
}

export async function waitForSettingsKeysAbsent(
  actors: ScenarioActors,
  keys: readonly string[]
): Promise<void> {
  await waitFor(
    async () => {
      const bucket = await settingsBucket(actors);
      return keys.every(
        (key) => !Object.prototype.hasOwnProperty.call(bucket, key)
      );
    },
    {
      timeoutMs: 8_000,
      intervalMs: 500,
      description: `absent settings keys ${keys.join(', ')}`,
    }
  );
}

async function ensureShipUnblocked(
  actors: ScenarioActors,
  ship: string
): Promise<void> {
  const blocked = await actors.bot.state.scry<string[]>('chat', '/blocked');
  if (Array.isArray(blocked) && blocked.includes(ship)) {
    await actors.bot.state.poke({
      app: 'chat',
      mark: 'chat-unblock-ship',
      json: { ship },
    });
    await sleep(1_000);
  }
}

function settingsValueEqual(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual ?? null) === JSON.stringify(expected ?? null);
}

function defaultSettingValue(key: string): unknown {
  switch (key) {
    case 'ownerListenEnabled':
      return true;
    case 'ownerListenDisabledChannels':
    case 'ownerListenEnabledChannels':
    case 'groupChannels':
      return [];
    case 'ownerListenDefault':
      return 'owned';
    case 'pendingApprovals':
      return '[]';
    case 'channelRules':
      return '{}';
    case 'defaultAuthorizedShips':
      return [];
    default:
      return null;
  }
}
