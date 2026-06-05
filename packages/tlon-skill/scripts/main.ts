#!/usr/bin/env bun

/**
 * tlon - Unified CLI for Tlon/Urbit operations
 *
 * Usage:
 *   tlon [options] <command> <subcommand> [args...]
 *
 * Commands:
 *   activity     Activity/notifications (mentions, replies, all, unreads)
 *   channels     Channel listing and management
 *   contacts     Contact/profile management
 *   dms          Direct message operations
 *   groups       Group management
 *   messages     Message history and search (dm, channel, history, search, context, post)
 *   notebook     Post to diary/notebook channels
 *   posts        Post reactions, edits, deletes
 *   settings     OpenClaw settings management
 */
import { createActivityDeps } from './activity-runtime';
import { setCliCredentialOverrides } from './api-client';
import { run as runActivityCommand } from './commands/activity';
import { formatUnexpectedError } from './commands/command';
import { run as runUploadCommand } from './commands/upload';
import { CredentialFlagError, parseGlobalCliOptions } from './credential-flags';
import { isTopLevelCommand } from './top-level-commands';
import { createUploadDeps } from './upload-runtime';

// Version is injected at build time via --define
declare const __VERSION__: string;
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : 'dev';

function printHelp() {
  console.log(`tlon v${VERSION} - Tlon/Urbit CLI

Usage:
  tlon [options] <command> <subcommand> [args...]

Commands:
  activity     Activity/notifications (mentions, replies, all, unreads)
  channels     Channel listing and management (dms, groups, info, update, delete, add/del-writers, add/del-readers)
  contacts     Contact/profile management (list, get, self, sync, add, remove, update-profile)
  dms          Direct message operations (send, reply, react, unreact, delete, accept, decline)
  expose       Manage public content exposure (list, show, hide, check, url)
  groups       Group management (list, create, info, join, request/accept invites, leave, delete, ...)
  hooks        Channel hooks management (list, add, edit, delete, order, config, cron, rest)
  messages     Message history and search (dm, channel, history, search, context, post)
  notebook     Post to diary/notebook channels
  posts        Post reactions, edits, deletes (react, unreact, edit, delete)
  settings     OpenClaw settings management (get, set, delete, allow-dm, ...)
  upload       Upload a file from URL, local path, or stdin

Credential Options (override defaults):
  --config <file>   Path to JSON config file with url + cookie or url + ship + code
  --url <url>       Ship URL (e.g., https://your-ship.tlon.network)
  --ship <~name>    Ship name (uses TLON_SKILL_DIR or cached credentials)
  --code <code>     Access code (e.g., sampel-ticlyt-migfun-falmel)
  --cookie <cookie> Pre-authenticated cookie (ship is parsed from cookie name unless --ship is set)

Valid credential forms:
  --config <file>
  --url <url> --cookie <cookie> [--ship <ship>] [--code <code>]
  --url <url> --ship <ship> --code <code>
  --ship <ship> when available in TLON_SKILL_DIR or cache

Incomplete or conflicting credential flag sets fail locally instead of merging with env vars.

Other Options:
  --verbose      Enable verbose subscription logging
  --help, -h     Show this help
  --version, -v  Show version

Config Resolution (first match wins):
  1. CLI credential flags
  2. TLON_CONFIG_FILE env var
  3. URBIT_URL/TLON_URL + URBIT_COOKIE/TLON_COOKIE
  4. URL + SHIP + CODE via URBIT_* or TLON_* env vars
  5. TLON_SHIP + TLON_SKILL_DIR (loads ships/<ship>.json)
  6. Ship-only cache lookup
  7. OpenClaw JSON config (~/.openclaw/openclaw.json)
  8. Single cached ship (auto-select if only one)

Cache writes:
  Code login and code fallback cache the fresh cookie. Provided-cookie flows do not copy cookies into cache.

Examples:
  tlon contacts list
  tlon messages dm ~sampel-palnet --limit 10
  tlon groups create "My Group" --description "A cool group"
  tlon groups create-owned "My Group" --owner ~zod
  tlon groups join ~host/group-slug
  tlon posts react chat/~host/channel 170.141.184... 👍
  tlon --config ~/ships/zod.json contacts self
  tlon --url https://zod.tlon.network --cookie "urbauth-~zod=0v..." contacts self
  tlon --url https://zod.tlon.network --ship ~zod --code abcd-efgh-ijkl-mnop contacts self
`);
}

async function main() {
  const rawArgs = process.argv.slice(2);

  let parsed;
  try {
    parsed = parseGlobalCliOptions(rawArgs);
  } catch (error: any) {
    if (error instanceof CredentialFlagError) {
      console.error('Error:', error.message);
      console.error('Run "tlon --help" for usage information.');
      process.exit(1);
    }
    throw error;
  }

  if (parsed.verbose) {
    process.env.TLON_VERBOSE = '1';
  }

  setCliCredentialOverrides(parsed.credentialOverrides);
  const args = parsed.args;

  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    console.log(VERSION);
    process.exit(0);
  }

  if (!isTopLevelCommand(command)) {
    console.error(`Unknown command: ${command}`);
    console.error('Run "tlon --help" for usage information.');
    process.exit(1);
  }

  const scriptArgs = args.slice(1);

  try {
    switch (command) {
      case 'activity': {
        const exitCode = await runActivityCommand(
          scriptArgs,
          createActivityDeps()
        );
        process.exit(exitCode);
        break;
      }
      case 'upload': {
        const exitCode = await runUploadCommand(scriptArgs, createUploadDeps());
        process.exit(exitCode);
        break;
      }
      case 'channels': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./channels');
        break;
      }
      case 'contacts': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./contacts');
        break;
      }
      case 'dms': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./dms');
        break;
      }
      case 'expose': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./expose');
        break;
      }
      case 'groups': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./groups');
        break;
      }
      case 'hooks': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./hooks');
        break;
      }
      case 'messages': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./messages');
        break;
      }
      case 'notebook': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./notebook-post');
        break;
      }
      case 'posts': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./posts');
        break;
      }
      case 'settings': {
        process.argv = ['tlon', command, ...scriptArgs];
        const mod = await import('./settings');
        break;
      }
    }
  } catch (error: any) {
    process.stderr.write(formatUnexpectedError(error));
    process.exit(1);
  }
}

main();
