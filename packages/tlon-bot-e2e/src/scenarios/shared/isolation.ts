import { waitFor, sleep } from '../../runtime/waiters.js';
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
