#!/usr/bin/env npx ts-node

/**
 * Manage exposed content on the clearweb via %expose agent
 *
 * Usage:
 *   tlon expose list                    # List all exposed content
 *   tlon expose show <cite-path>        # Expose a post publicly
 *   tlon expose hide <cite-path>        # Hide an exposed post
 *   tlon expose check <cite-path>       # Check if a post is exposed
 *   tlon expose url <cite-path>         # Get the public URL for a post
 *
 * Cite path format: /1/chan/<kind>/~<host>/<channel>/<type>/<post-id>
 * Example: /1/chan/chat/~nocsyx-lassul/my-channel/msg/170.141.184...
 *
 * You can also use a simplified format that will be expanded:
 *   chat/~host/channel/170.141...  ->  /1/chan/chat/~host/channel/msg/170.141...
 *   diary/~host/channel/170.141... ->  /1/chan/diary/~host/channel/note/170.141...
 */
import { poke, scry } from '@tloncorp/api';

import { ensureClient } from './api-client';
import {
  isHelpArg,
  printErrorAndExit,
  printHelpAndExit,
  printUsageAndExit,
  wantsHelp,
} from './cli-utils';

const EXPOSE_HELP = `Usage: tlon expose <command>

Manage public exposure of Tlon content via the %expose agent.

Commands:
  list                    List all exposed content with public URLs
  show <cite-path>        Expose a post publicly
  hide <cite-path>        Hide an exposed post
  check <cite-path>       Check if a post is exposed
  url <cite-path>         Get the public URL for a post

Cite path formats:
  Simplified:  chat/~host/channel/170.141...
               diary/~host/channel/170.141...
               heap/~host/channel/170.141...

  Full:        /1/chan/chat/~host/channel/msg/170.141...
               /1/chan/diary/~host/channel/note/170.141...
               /1/chan/heap/~host/channel/curio/170.141...

Examples:
  tlon expose list
  tlon expose show chat/~nocsyx-lassul/my-channel/170.141.184.507...
  tlon expose hide chat/~nocsyx-lassul/my-channel/170.141.184.507...
  tlon expose check diary/~nocsyx-lassul/blog/170.141.184.507...
  tlon expose url diary/~nocsyx-lassul/blog/170.141.184.507...`;

const EXPOSE_COMMAND_HELP: Record<string, string> = {
  list: 'Usage: tlon expose list',
  show: 'Usage: tlon expose show <cite-path>\nExample: tlon expose show chat/~host/channel/170.141...',
  hide: 'Usage: tlon expose hide <cite-path>',
  check: 'Usage: tlon expose check <cite-path>',
  url: 'Usage: tlon expose url <cite-path>',
};

function getExposeHelp(command?: string): string {
  return command ? EXPOSE_COMMAND_HELP[command] ?? EXPOSE_HELP : EXPOSE_HELP;
}

function validateExposeArgs(args: string[]): void {
  const command = args[0];
  if (!command || !EXPOSE_COMMAND_HELP[command]) {
    printUsageAndExit(EXPOSE_HELP);
  }
  if (command !== 'list' && !args[1]) {
    printUsageAndExit(EXPOSE_COMMAND_HELP[command]);
  }
}

// Expand a simplified cite path to full format
// chat/~host/channel/170.141... -> /1/chan/chat/~host/channel/msg/170.141...
function expandCitePath(input: string): string {
  // Already in full format
  if (input.startsWith('/1/')) {
    return input;
  }

  // Handle simplified format: kind/~host/channel/post-id
  const parts = input.split('/');
  if (parts.length < 4) {
    throw new Error(
      `Invalid cite path. Expected format: chat/~host/channel/post-id or /1/chan/chat/~host/channel/msg/post-id`
    );
  }

  const kind = parts[0]; // chat, diary, heap
  const host = parts[1]; // ~ship
  const channel = parts[2]; // channel-name
  const postId = parts.slice(3).join('/'); // post-id (may have dots)

  // Determine the content type based on channel kind
  let contentType: string;
  switch (kind) {
    case 'chat':
      contentType = 'msg';
      break;
    case 'diary':
      contentType = 'note';
      break;
    case 'heap':
      contentType = 'curio';
      break;
    default:
      throw new Error(
        `Unknown channel kind: ${kind}. Expected chat, diary, or heap.`
      );
  }

  return `/1/chan/${kind}/${host}/${channel}/${contentType}/${postId}`;
}

// Convert a cite path to a URL path for the public endpoint
function citePathToUrlPath(citePath: string): string {
  // Remove leading /1/ version prefix for URL
  // /1/chan/chat/~host/channel/msg/123 -> /chan/chat/~host/channel/msg/123
  if (citePath.startsWith('/1/')) {
    return citePath.slice(2);
  }
  return citePath;
}

// List all exposed content
async function listExposed(): Promise<string[]> {
  try {
    const result = await scry<unknown>({
      app: 'expose',
      path: '/show',
    });

    // Result is a set of cites, represented as an array or set
    if (Array.isArray(result)) {
      return result.map((cite: any) => formatCite(cite));
    }

    // Handle set representation
    if (result && typeof result === 'object') {
      const values = Object.values(result);
      return values.map((cite: any) => formatCite(cite));
    }

    return [];
  } catch (err: any) {
    if (err?.message?.includes('404') || err?.message?.includes('not found')) {
      return [];
    }
    throw err;
  }
}

// Format a cite object to a readable path
function formatCite(cite: any): string {
  if (typeof cite === 'string') {
    return cite;
  }

  // Handle structured cite format from Urbit
  // { chan: { nest: [kind, [ship, name]], wer: [type, id, ...] } }
  if (cite.chan) {
    const { nest, wer } = cite.chan;
    const [kind, [ship, name]] = nest;
    const werPath = Array.isArray(wer) ? wer.join('/') : wer;
    return `/1/chan/${kind}/~${ship}/${name}/${werPath}`;
  }

  // Fallback: JSON stringify
  return JSON.stringify(cite);
}

// Check if a specific cite is exposed
async function checkExposed(citePath: string): Promise<boolean> {
  const fullPath = expandCitePath(citePath);

  try {
    const result = await scry<boolean>({
      app: 'expose',
      path: `/show${fullPath}`,
    });
    return !!result;
  } catch (err: any) {
    // 404 means not exposed
    if (err?.message?.includes('404') || err?.message?.includes('not found')) {
      return false;
    }
    throw err;
  }
}

// Expose a post publicly
async function showPost(citePath: string): Promise<void> {
  const fullPath = expandCitePath(citePath);

  // Convert path string to path array for poke
  // /1/chan/chat/~host/channel/msg/123 -> ["1", "chan", "chat", "~host", "channel", "msg", "123"]
  const pathParts = fullPath.split('/').filter((p) => p.length > 0);

  await poke({
    app: 'expose',
    mark: 'json',
    json: {
      show: pathParts,
    },
  });
}

// Hide an exposed post
async function hidePost(citePath: string): Promise<void> {
  const fullPath = expandCitePath(citePath);
  const pathParts = fullPath.split('/').filter((p) => p.length > 0);

  await poke({
    app: 'expose',
    mark: 'json',
    json: {
      hide: pathParts,
    },
  });
}

// Get the public URL for an exposed post
function getPublicUrl(citePath: string, shipUrl: string): string {
  const fullPath = expandCitePath(citePath);
  const urlPath = citePathToUrlPath(fullPath);
  return `${shipUrl}/expose${urlPath}`;
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (isHelpArg(command)) {
    printHelpAndExit(EXPOSE_HELP);
  }

  if (wantsHelp(args.slice(1))) {
    printHelpAndExit(getExposeHelp(command));
  }

  validateExposeArgs(args);

  const config = await ensureClient();

  try {
    switch (command) {
      case 'list': {
        const exposed = await listExposed();
        if (exposed.length === 0) {
          console.log('No content currently exposed.');
        } else {
          console.log(`Exposed content (${exposed.length}):\n`);
          for (const cite of exposed) {
            const url = getPublicUrl(cite, config.url);
            console.log(`  ${cite}`);
            console.log(`    → ${url}\n`);
          }
        }
        break;
      }

      case 'show': {
        const citePath = args[1];
        if (!citePath) {
          printUsageAndExit(EXPOSE_COMMAND_HELP.show);
        }

        await showPost(citePath);
        const fullPath = expandCitePath(citePath);
        const url = getPublicUrl(fullPath, config.url);
        console.log(`✓ Post exposed`);
        console.log(`  Public URL: ${url}`);
        break;
      }

      case 'hide': {
        const citePath = args[1];
        if (!citePath) {
          printUsageAndExit(EXPOSE_COMMAND_HELP.hide);
        }

        await hidePost(citePath);
        console.log('✓ Post hidden');
        break;
      }

      case 'check': {
        const citePath = args[1];
        if (!citePath) {
          printUsageAndExit(EXPOSE_COMMAND_HELP.check);
        }

        const isExposed = await checkExposed(citePath);
        if (isExposed) {
          const fullPath = expandCitePath(citePath);
          const url = getPublicUrl(fullPath, config.url);
          console.log(`✓ Post is exposed`);
          console.log(`  Public URL: ${url}`);
        } else {
          console.log('✗ Post is not exposed');
        }
        break;
      }

      case 'url': {
        const citePath = args[1];
        if (!citePath) {
          printUsageAndExit(EXPOSE_COMMAND_HELP.url);
        }

        const fullPath = expandCitePath(citePath);
        const url = getPublicUrl(fullPath, config.url);
        console.log(url);
        break;
      }

      default:
        printUsageAndExit(EXPOSE_HELP);
    }

    process.exit(0);
  } catch (error) {
    printErrorAndExit(error);
  }
}

main();
