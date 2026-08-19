#!/usr/bin/env npx ts-node

/**
 * Kits API for Tlon — manage %kits packages and installs
 *
 * Usage:
 *   tlon kits list
 *   tlon kits show <id>
 *   tlon kits add <dir>
 *   tlon kits fetch <ship> <id>
 *   tlon kits install <id> [--name <term>] [--title <title>]
 *   tlon kits installs
 *   tlon kits uninstall <flag>
 *   tlon kits card <id> <nest>
 */
import {
  type Story,
  appendKitToPostBlob,
  getCurrentUserId,
  poke,
  scry,
  sendPost,
} from '@tloncorp/api';
import { loadKit, toWireKit } from '@tloncorp/tlon-kits';
import type { WireKit, WireManifest } from '@tloncorp/tlon-kits';

import { ensureClient, normalizeShip } from './api-client';
import {
  getOption,
  isHelpArg,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  wantsHelp,
} from './cli-utils';

const KITS_HELP = `Usage: tlon kits <command>

Manage %kits packages (shareable bot behavior bundles) and their installs.

Commands:
  list                                       List kits in the local library
  show <id>                                  Show a kit's manifest and files
  add <dir>                                  Load a kit directory and add it to the library
  fetch <ship> <id>                          Fetch a kit from a publisher ship
  install <id> [--name <term>] [--title <title>]
                                             Instantiate a kit: create a group + places
  installs                                   List installed kits by group flag
  uninstall <flag>                           Uninstall from a group (~ship/name)
  card <id> <nest>                           Post a shareable kit card to a chat channel

Examples:
  tlon kits list
  tlon kits show book-club
  tlon kits add ./kits/book-club
  tlon kits fetch ~sampel-palnet book-club
  tlon kits install book-club --name book-club-1 --title "Book Club"
  tlon kits uninstall ~sampel-palnet/book-club-1
  tlon kits card book-club chat/~sampel-palnet/general`;

const KITS_COMMAND_HELP: Record<string, string> = {
  list: 'Usage: tlon kits list',
  show: 'Usage: tlon kits show <id>\nExample: tlon kits show book-club',
  add: 'Usage: tlon kits add <dir>\nExample: tlon kits add ./kits/book-club',
  fetch:
    'Usage: tlon kits fetch <ship> <id>\nExample: tlon kits fetch ~sampel-palnet book-club',
  install:
    'Usage: tlon kits install <id> [--name <term>] [--title <title>]\nDefaults: --name <id>-<4 random chars>, --title the kit name\nExample: tlon kits install book-club --name book-club-1 --title "Book Club"',
  installs: 'Usage: tlon kits installs',
  uninstall:
    'Usage: tlon kits uninstall <flag>\nExample: tlon kits uninstall ~sampel-palnet/book-club-1',
  card: 'Usage: tlon kits card <id> <nest>\nPosts a chat message carrying the kit as a shareable card.\nExample: tlon kits card book-club chat/~sampel-palnet/general',
};

type KitInstall = {
  id: string;
  version: string;
  publisher: string;
  places: Record<string, string>;
  setup: 'pending' | 'done';
  installed: string;
};

const TERM_PATTERN = /^[a-z][a-z0-9-]*$/;

function getKitsHelp(command?: string): string {
  return command ? KITS_COMMAND_HELP[command] ?? KITS_HELP : KITS_HELP;
}

function validateKitsArgs(args: string[]): void {
  const command = args[0];
  if (!command || !KITS_COMMAND_HELP[command]) {
    printUsageAndExit(KITS_HELP);
  }
  const required: Record<string, number> = {
    show: 1,
    add: 1,
    fetch: 2,
    install: 1,
    uninstall: 1,
    card: 2,
  };
  const needed = required[command] ?? 0;
  for (let i = 1; i <= needed; i += 1) {
    if (!args[i] || args[i].startsWith('--')) {
      printUsageAndExit(KITS_COMMAND_HELP[command]);
    }
  }
}

function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('404') || message.includes('not found');
}

function generateInstallSuffix(): string {
  const alphanumeric = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
  }
  return suffix;
}

function normalizeFlag(flag: string): string {
  const [ship, name, ...rest] = flag.split('/');
  if (!ship || !name || rest.length > 0) {
    throw new Error(`Invalid group flag: ${flag} (expected ~ship/name)`);
  }
  return `${normalizeShip(ship)}/${name}`;
}

async function fetchLibraryKit(id: string): Promise<WireKit> {
  try {
    const result = await scry<{ kit: WireKit }>({
      app: 'kits',
      path: `/v1/kits/${id}`,
    });
    return result.kit;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new Error(
        `Kit ${id} is not in the library. Use "tlon kits list" to see available kits.`
      );
    }
    throw error;
  }
}

function printManifestSummary(manifest: WireManifest): void {
  console.log(`${manifest.name} (${manifest.id}) v${manifest.version}`);
  console.log(`  Publisher: ${manifest.publisher}`);
  console.log(`  Scope: ${manifest.scope}`);
  if (manifest.image) {
    console.log(`  Image: ${manifest.image}`);
  }
  console.log(`  ${manifest.description}`);

  if (manifest.places.length > 0) {
    console.log('\nPlaces:');
    for (const place of manifest.places) {
      console.log(`  ${place.name} (${place.kind}): ${place.title}`);
    }
  }

  if (manifest.bindings.length > 0) {
    console.log('\nBindings:');
    for (const binding of manifest.bindings) {
      const trigger = binding.trigger ? ` on ${binding.trigger}` : '';
      console.log(
        `  ${binding.file} [${binding.scope}, ${binding.load}${trigger}]`
      );
    }
  }

  if (manifest.schedules.length > 0) {
    console.log('\nSchedules:');
    for (const schedule of manifest.schedules) {
      console.log(
        `  ${schedule.id} (${schedule.cron}): ${schedule.description}`
      );
    }
  }

  if (manifest.scaffolds.length > 0) {
    console.log('\nScaffolds:');
    for (const scaffold of manifest.scaffolds) {
      console.log(`  ${scaffold.file} -> ${scaffold.workspace}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(KITS_HELP);
  }

  if (wantsHelp(args.slice(1))) {
    printHelpAndExit(getKitsHelp(command));
  }

  validateKitsArgs(args);

  await ensureClient();

  try {
    switch (command) {
      case 'list': {
        const result = await scry<{ kits: WireManifest[] }>({
          app: 'kits',
          path: '/v1/kits',
        });
        if (result.kits.length === 0) {
          console.log('No kits in library.');
        } else {
          for (const manifest of result.kits) {
            console.log(
              `${manifest.id}  ${manifest.name}  v${manifest.version}  ${manifest.publisher}`
            );
          }
        }
        break;
      }

      case 'show': {
        const kit = await fetchLibraryKit(args[1]);
        printManifestSummary(kit.manifest);
        const files = Object.keys(kit.files).sort();
        console.log(`\nFiles (${files.length}):`);
        for (const file of files) {
          console.log(`  ${file}`);
        }
        break;
      }

      case 'add': {
        const kit = loadKit(args[1]);
        await poke({
          app: 'kits',
          mark: 'kits-action-1',
          json: { add: { kit: toWireKit(kit) } },
        });
        console.log(
          `✓ Added kit ${kit.manifest.id} v${kit.manifest.kitVersion} to the library`
        );
        break;
      }

      case 'fetch': {
        const ship = normalizeShip(args[1]);
        const id = args[2];
        await poke({
          app: 'kits',
          mark: 'kits-action-1',
          json: { fetch: { ship, id } },
        });
        console.log(`✓ Fetch requested: ${id} from ${ship}`);
        console.log(
          '  The kit arrives asynchronously; check "tlon kits list".'
        );
        break;
      }

      case 'install': {
        const id = args[1];
        const kit = await fetchLibraryKit(id);
        const name =
          getOption(args, 'name') ?? `${id}-${generateInstallSuffix()}`;
        if (!TERM_PATTERN.test(name)) {
          throw new Error(
            `Invalid --name "${name}": must be a kebab-case term (lowercase letters, digits, hyphens; starts with a letter)`
          );
        }
        const title = getOption(args, 'title') ?? kit.manifest.name;
        await poke({
          app: 'kits',
          mark: 'kits-action-1',
          json: {
            install: {
              id,
              name,
              meta: { title, description: '', image: '', cover: '' },
            },
          },
        });
        console.log(`✓ Install requested: ${id} as ${name} ("${title}")`);
        console.log('  Check "tlon kits installs" for the resulting group.');
        break;
      }

      case 'installs': {
        const result = await scry<{ installs: Record<string, KitInstall> }>({
          app: 'kits',
          path: '/v1/installs',
        });
        const entries = Object.entries(result.installs);
        if (entries.length === 0) {
          console.log('No kits installed.');
        } else {
          for (const [flag, install] of entries) {
            console.log(
              `${flag}  ${install.id} v${install.version}  setup:${install.setup}  installed:${install.installed}`
            );
            for (const [place, nest] of Object.entries(install.places)) {
              console.log(`  ${place} -> ${nest}`);
            }
          }
        }
        break;
      }

      case 'uninstall': {
        const flag = normalizeFlag(args[1]);
        await poke({
          app: 'kits',
          mark: 'kits-action-1',
          json: { uninstall: { flag } },
        });
        console.log(`✓ Uninstall requested for ${flag}`);
        break;
      }

      case 'card': {
        const nest = args[2];
        if (!nest.startsWith('chat/')) {
          throw new Error(
            `Kit cards can only be posted to chat channels (got ${nest})`
          );
        }
        const kit = await fetchLibraryKit(args[1]);
        const manifest = kit.manifest;
        // post blob wire format: a JSON array of typed, versioned entries
        // (see docs/tlon-apps/post-blobs.md)
        const blob = appendKitToPostBlob(undefined, {
          id: manifest.id,
          publisher: manifest.publisher,
          kitVersion: manifest.version,
          name: manifest.name,
          description: manifest.description,
          image: manifest.image,
        });
        const text = manifest.description
          ? `${manifest.name} — ${manifest.description}`
          : manifest.name;
        const content: Story = [{ inline: [text] }];
        await sendPost({
          channelId: nest,
          authorId: getCurrentUserId(),
          sentAt: Date.now(),
          content,
          blob,
        });
        console.log(`✓ Posted kit card for ${manifest.id} to ${nest}`);
        break;
      }

      default:
        printUsageAndExit(KITS_HELP);
    }

    process.exit(0);
  } catch (error) {
    printErrorAndExit(error);
  }
}

main();
