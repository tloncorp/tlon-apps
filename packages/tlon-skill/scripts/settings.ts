#!/usr/bin/env npx ts-node

/**
 * Manage OpenClaw settings in Urbit settings-store.
 *
 * Usage:
 *   npx ts-node scripts/settings.ts get
 *   npx ts-node scripts/settings.ts set dmAllowlist '["~nocsyx-lassul", "~sabrys-nocwyd"]'
 *   npx ts-node scripts/settings.ts allow-dm ~ship
 *   npx ts-node scripts/settings.ts allow-channel chat/~host/channel
 *   npx ts-node scripts/settings.ts open-channel chat/~host/channel
 *   npx ts-node scripts/settings.ts set-rule chat/~host/channel open
 *   npx ts-node scripts/settings.ts set-rule chat/~host/channel restricted ~ship1 ~ship2
 */
import { poke, scry } from '@tloncorp/api';

import { ensureClient, normalizeShip } from './api-client';
import {
  isHelpArg,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  wantsHelp,
} from './cli-utils';

const SETTINGS_DESK = 'moltbot';
const SETTINGS_BUCKET = 'tlon';

const SETTINGS_HELP = `Usage: tlon settings <command>

Commands:
  get                              Show all settings
  set <key> <json>                 Set a setting value
  delete <key>                     Delete a setting

  allow-dm <ship>                  Add ship to DM allowlist
  remove-dm <ship>                 Remove ship from DM allowlist

  allow-channel <nest>             Add channel to watched list
  remove-channel <nest>            Remove channel from watched list

  open-channel <nest>              Set channel to open mode (anyone can interact)
  restrict-channel <nest> [ships]  Set channel to restricted mode

  authorize-ship <ship>            Add to default authorized ships
  deauthorize-ship <ship>          Remove from default authorized ships

Examples:
  tlon settings allow-dm ~nocsyx-lassul
  tlon settings open-channel chat/~nocsyx-lassul/bongtable
  tlon settings set showModelSig true`;

const SETTINGS_COMMAND_HELP: Record<string, string> = {
  get: 'Usage: tlon settings get',
  set: 'Usage: tlon settings set <key> <json-value>',
  delete: 'Usage: tlon settings delete <key>',
  del: 'Usage: tlon settings delete <key>',
  'allow-dm': 'Usage: tlon settings allow-dm <ship>',
  'add-dm': 'Usage: tlon settings allow-dm <ship>',
  'remove-dm': 'Usage: tlon settings remove-dm <ship>',
  'allow-channel': 'Usage: tlon settings allow-channel <channel-nest>',
  'add-channel': 'Usage: tlon settings allow-channel <channel-nest>',
  'remove-channel': 'Usage: tlon settings remove-channel <channel-nest>',
  'open-channel': 'Usage: tlon settings open-channel <channel-nest>',
  'restrict-channel':
    'Usage: tlon settings restrict-channel <channel-nest> [ships...]',
  'set-rule':
    'Usage: tlon settings set-rule <channel-nest> <open|restricted> [ships...]',
  'authorize-ship': 'Usage: tlon settings authorize-ship <ship>',
  'add-auth': 'Usage: tlon settings authorize-ship <ship>',
  'deauthorize-ship': 'Usage: tlon settings deauthorize-ship <ship>',
  'remove-auth': 'Usage: tlon settings deauthorize-ship <ship>',
};

function getSettingsHelp(command?: string): string {
  return command
    ? (SETTINGS_COMMAND_HELP[command] ?? SETTINGS_HELP)
    : SETTINGS_HELP;
}

function validateSettingsArgs(args: string[]): void {
  const command = args[0];
  if (!command || !SETTINGS_COMMAND_HELP[command]) {
    printUsageAndExit(SETTINGS_HELP);
  }

  switch (command) {
    case 'get':
      return;
    case 'set': {
      if (!args[1] || args[2] === undefined)
        printUsageAndExit(SETTINGS_COMMAND_HELP.set);
      return;
    }
    case 'delete':
    case 'del':
    case 'allow-dm':
    case 'add-dm':
    case 'remove-dm':
    case 'allow-channel':
    case 'add-channel':
    case 'remove-channel':
    case 'open-channel':
    case 'restrict-channel':
    case 'authorize-ship':
    case 'add-auth':
    case 'deauthorize-ship':
    case 'remove-auth': {
      if (!args[1]) printUsageAndExit(SETTINGS_COMMAND_HELP[command]);
      return;
    }
    case 'set-rule': {
      const mode = args[2];
      if (!args[1] || !mode || (mode !== 'open' && mode !== 'restricted')) {
        printUsageAndExit(SETTINGS_COMMAND_HELP['set-rule']);
      }
      return;
    }
  }
}

async function getSettings(): Promise<Record<string, unknown>> {
  try {
    const result = await scry<{
      all: Record<string, Record<string, Record<string, unknown>>>;
    }>({
      app: 'settings',
      path: '/all',
    });
    return (
      (result?.all?.[SETTINGS_DESK]?.[SETTINGS_BUCKET] as Record<
        string,
        unknown
      >) ?? {}
    );
  } catch (err: any) {
    if (err?.message?.includes('404') || err?.message?.includes('not found')) {
      return {};
    }
    throw err;
  }
}

async function putEntry(key: string, value: unknown): Promise<void> {
  await poke({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'put-entry': {
        desk: SETTINGS_DESK,
        'bucket-key': SETTINGS_BUCKET,
        'entry-key': key,
        value,
      },
    },
  });
  console.log(`✓ Set ${key}`);
}

async function delEntry(key: string): Promise<void> {
  await poke({
    app: 'settings',
    mark: 'settings-event',
    json: {
      'del-entry': {
        desk: SETTINGS_DESK,
        'bucket-key': SETTINGS_BUCKET,
        'entry-key': key,
      },
    },
  });
  console.log(`✓ Deleted ${key}`);
}

async function addToArray(key: string, item: string): Promise<void> {
  const settings = await getSettings();
  const current = (settings[key] as string[]) ?? [];
  const normalized =
    key === 'dmAllowlist' || key === 'defaultAuthorizedShips'
      ? normalizeShip(item)
      : item;

  if (current.includes(normalized)) {
    console.log(`${normalized} already in ${key}`);
    return;
  }

  await putEntry(key, [...current, normalized]);
}

async function removeFromArray(key: string, item: string): Promise<void> {
  const settings = await getSettings();
  const current = (settings[key] as string[]) ?? [];
  const normalized =
    key === 'dmAllowlist' || key === 'defaultAuthorizedShips'
      ? normalizeShip(item)
      : item;

  const updated = current.filter((x) => x !== normalized);
  if (updated.length === current.length) {
    console.log(`${normalized} not in ${key}`);
    return;
  }

  await putEntry(key, updated);
}

function parseChannelRules(
  value: unknown
): Record<string, { mode?: string; allowedShips?: string[] }> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, { mode?: string; allowedShips?: string[] }>;
  }
  return {};
}

async function setChannelRule(
  channel: string,
  mode: 'open' | 'restricted',
  allowedShips?: string[]
): Promise<void> {
  const settings = await getSettings();
  const rules = parseChannelRules(settings.channelRules);

  const rule: Record<string, unknown> = { mode };
  if (mode === 'restricted' && allowedShips?.length) {
    rule.allowedShips = allowedShips.map(normalizeShip);
  }

  // Store as JSON string (settings-store doesn't support nested objects)
  await putEntry('channelRules', JSON.stringify({ ...rules, [channel]: rule }));
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const command = rawArgs[0];
  const args = rawArgs.slice(1);

  try {
    if (isHelpArg(command)) {
      printHelpAndExit(SETTINGS_HELP);
    }

    if (wantsHelp(args)) {
      printHelpAndExit(getSettingsHelp(command));
    }

    validateSettingsArgs(rawArgs);

    await ensureClient();
    switch (command) {
      case 'get': {
        const settings = await getSettings();
        console.log(JSON.stringify(settings, null, 2));
        break;
      }

      case 'set': {
        const [key, jsonValue] = args;
        if (!key || jsonValue === undefined) {
          printUsageAndExit(SETTINGS_COMMAND_HELP.set);
        }
        const value = JSON.parse(jsonValue);
        await putEntry(key, value);
        break;
      }

      case 'delete':
      case 'del': {
        const [key] = args;
        if (!key) {
          printUsageAndExit(SETTINGS_COMMAND_HELP.delete);
        }
        await delEntry(key);
        break;
      }

      case 'allow-dm':
      case 'add-dm': {
        const [ship] = args;
        if (!ship) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['allow-dm']);
        }
        await addToArray('dmAllowlist', ship);
        break;
      }

      case 'remove-dm': {
        const [ship] = args;
        if (!ship) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['remove-dm']);
        }
        await removeFromArray('dmAllowlist', ship);
        break;
      }

      case 'allow-channel':
      case 'add-channel': {
        const [channel] = args;
        if (!channel) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['allow-channel']);
        }
        await addToArray('groupChannels', channel);
        break;
      }

      case 'remove-channel': {
        const [channel] = args;
        if (!channel) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['remove-channel']);
        }
        await removeFromArray('groupChannels', channel);
        break;
      }

      case 'open-channel': {
        const [channel] = args;
        if (!channel) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['open-channel']);
        }
        await setChannelRule(channel, 'open');
        console.log(`✓ Opened ${channel} to all`);
        break;
      }

      case 'restrict-channel': {
        const [channel, ...ships] = args;
        if (!channel) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['restrict-channel']);
        }
        await setChannelRule(
          channel,
          'restricted',
          ships.length ? ships : undefined
        );
        console.log(
          `✓ Restricted ${channel}${ships.length ? ` to ${ships.join(', ')}` : ''}`
        );
        break;
      }

      case 'set-rule': {
        const [channel, mode, ...ships] = args;
        if (!channel || !mode || (mode !== 'open' && mode !== 'restricted')) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['set-rule']);
        }
        await setChannelRule(
          channel,
          mode as 'open' | 'restricted',
          ships.length ? ships : undefined
        );
        break;
      }

      case 'authorize-ship':
      case 'add-auth': {
        const [ship] = args;
        if (!ship) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['authorize-ship']);
        }
        await addToArray('defaultAuthorizedShips', ship);
        break;
      }

      case 'deauthorize-ship':
      case 'remove-auth': {
        const [ship] = args;
        if (!ship) {
          printUsageAndExit(SETTINGS_COMMAND_HELP['deauthorize-ship']);
        }
        await removeFromArray('defaultAuthorizedShips', ship);
        break;
      }

      default:
        printUsageAndExit(SETTINGS_HELP);
    }
    process.exit(0);
  } finally {
    // no-op: @tloncorp/api client is process-scoped
  }
}

main().catch(printErrorAndExit);
