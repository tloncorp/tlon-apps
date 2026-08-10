import type {
  OpenClawConfig,
  OpenClawPluginApi,
  PluginCommandContext,
  PluginCommandResult,
} from 'openclaw/plugin-sdk/core';

import {
  type createMigrateCommandHandler,
  routeMigrateCommand,
} from './migrate-command.js';
import { resolveBridgeForCommand } from './monitor/command-auth.js';
import { handleOwnerListenCommand } from './owner-listen-command.js';

// Contact-profile key under which the bot advertises its slash-command
// manifest (wire contract: docs/bot-command-manifests.md in tlon-apps).
export const BOT_COMMANDS_CONTACT_KEY = 'bot-commands';
// The client rejects raw manifests above this size; the backend's 10kB jam
// cap covers the whole profile, so a publish failure is a real, non-fatal
// outcome regardless.
export const BOT_COMMANDS_MAX_MANIFEST_BYTES = 6000;

export interface TlonCommandManifestEntry {
  title: string;
  subtitle?: string;
  keywords?: string[];
  insertText?: string;
}

// What the inline handlers used to capture from registerFull's scope.
export interface TlonCommandDeps {
  renderTlonVersion: () => Promise<{ text: string }>;
  handleMigrateCommand: ReturnType<typeof createMigrateCommandHandler>;
  config: OpenClawConfig;
}

export interface TlonCommandRegistryEntry {
  name: string;
  description: string;
  acceptsArgs?: boolean;
  // `false` means handled-but-not-advertised. All current OpenClaw plugin
  // commands are advertised.
  manifest: TlonCommandManifestEntry | false;
  handler: (
    ctx: PluginCommandContext,
    deps: TlonCommandDeps
  ) => Promise<PluginCommandResult>;
}

// The single source of truth for the plugin's slash commands: registration
// (index.ts registerFull) and the advertised manifest both derive from this
// table, so the manifest can only list commands that are actually
// registered.
//
// OpenClaw CORE commands (/status, /help, /new) are deliberately absent:
// the core's builtin command registry is not exported from the `openclaw`
// npm package at the pinned version (2026.5.28), so their presence cannot
// be parity-asserted in CI, and advertising unverifiable commands is the
// exact bug this manifest exists to prevent. They still work when typed;
// they just are not suggested. Revisit if the core ever exports its
// command registry.
export const TLON_COMMAND_REGISTRY: TlonCommandRegistryEntry[] = [
  {
    name: 'tlon-version',
    description: 'Show Tlon plugin version.',
    manifest: {
      title: 'Tlon plugin version',
      subtitle: 'Show the installed OpenClaw Tlon plugin version',
      keywords: ['version', 'plugin', 'openclaw'],
    },
    handler: async (_ctx, deps) => {
      return deps.renderTlonVersion();
    },
  },
  {
    name: 'tlon',
    description: 'Tlon plugin diagnostics. Usage: /tlon version',
    acceptsArgs: true,
    manifest: {
      title: 'Tlon diagnostics',
      subtitle: 'Tlon plugin diagnostics. Usage: /tlon version',
      keywords: ['tlon', 'diagnostics', 'version'],
    },
    handler: async (ctx, deps) => {
      const args = (ctx.args ?? '').trim().toLowerCase();
      if (args !== 'version') {
        return { text: 'Usage: /tlon version' };
      }

      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      return deps.renderTlonVersion();
    },
  },
  {
    name: 'allow',
    description: 'Allow a pending DM/channel/group request',
    acceptsArgs: true,
    manifest: {
      title: 'Allow request',
      subtitle: 'Approve a pending request by id',
      keywords: ['approve', 'approval', 'request'],
    },
    handler: async (ctx) => {
      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      return {
        text: await result.bridge.handleAction(
          'approve',
          ctx.args?.trim() || undefined
        ),
      };
    },
  },
  {
    name: 'reject',
    description: 'Reject a pending DM/channel/group request',
    acceptsArgs: true,
    manifest: {
      title: 'Reject request',
      subtitle: 'Decline a pending request by id',
      keywords: ['deny', 'decline', 'approval', 'request'],
    },
    handler: async (ctx) => {
      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      return {
        text: await result.bridge.handleAction(
          'deny',
          ctx.args?.trim() || undefined
        ),
      };
    },
  },
  {
    name: 'ban',
    description: 'Ban a ship and deny its pending request',
    acceptsArgs: true,
    manifest: {
      title: 'Ban request',
      subtitle: 'Block a ship and deny its pending request',
      keywords: ['block', 'deny', 'ship', 'approval'],
    },
    handler: async (ctx) => {
      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      return {
        text: await result.bridge.handleAction(
          'block',
          ctx.args?.trim() || undefined
        ),
      };
    },
  },
  {
    name: 'pending',
    description: 'List pending approval requests',
    manifest: {
      title: 'Pending approvals',
      subtitle: 'List pending DM, channel, and group requests',
      keywords: ['approval', 'requests', 'owner'],
    },
    handler: async (ctx) => {
      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      return await result.bridge.getPendingApprovalsReply();
    },
  },
  {
    name: 'banned',
    description: 'List banned ships',
    manifest: {
      title: 'Banned ships',
      subtitle: 'List currently banned ships',
      keywords: ['blocked', 'ships', 'list'],
    },
    handler: async (ctx) => {
      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      return { text: await result.bridge.getBlockedList() };
    },
  },
  {
    name: 'unban',
    description: 'Unban a ship (e.g. /unban ~sampel-palnet)',
    acceptsArgs: true,
    manifest: {
      title: 'Unban ship',
      subtitle: 'Remove a ship from the ban list',
      keywords: ['unblock', 'ship', 'allow'],
    },
    handler: async (ctx) => {
      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      const ship = ctx.args?.trim();
      if (!ship) {
        return { text: 'Usage: /unban ~ship-name' };
      }
      return { text: await result.bridge.handleUnblock(ship) };
    },
  },
  {
    name: 'owner-listen',
    description:
      'Control whether the bot listens for the owner without @-mention in owned channels. ' +
      'Usage: /owner-listen [on|off|status|list] [<channel-nest>]; ' +
      '/owner-listen all [on|off] for the global kill switch.',
    acceptsArgs: true,
    manifest: {
      title: 'Owner listen',
      subtitle: 'Let the owner session listen in this channel',
      keywords: ['owner', 'listen', 'agent'],
    },
    handler: async (ctx) => {
      const result = resolveBridgeForCommand(ctx);
      if ('error' in result) {
        return { text: result.error };
      }
      const text = await handleOwnerListenCommand(
        result.bridge,
        ctx.args,
        ctx.from
      );
      return { text };
    },
  },
  {
    name: 'migrate',
    description:
      'Run or clean up a diary-to-notes migration. Usage: ' +
      '/migrate <diary-nest> [--allow-write-widening] | ' +
      '/migrate cleanup <notes-nest>',
    acceptsArgs: true,
    manifest: {
      title: 'Migrate diary to notes',
      subtitle: 'Run or clean up a diary-to-notes migration',
      keywords: ['migrate', 'diary', 'notes', 'migration'],
    },
    handler: async (ctx, deps) => {
      return {
        text: await routeMigrateCommand(
          ctx,
          ctx.args,
          deps.handleMigrateCommand,
          deps.config
        ),
      };
    },
  },
];

// Register every command in the table. Called from registerFull; the
// previous inline api.registerCommand calls all live in the table now so
// registration and the advertised manifest cannot drift apart.
export function registerTlonCommands(
  api: Pick<OpenClawPluginApi, 'registerCommand'>,
  deps: TlonCommandDeps
): void {
  for (const entry of TLON_COMMAND_REGISTRY) {
    api.registerCommand({
      name: entry.name,
      description: entry.description,
      ...(entry.acceptsArgs ? { acceptsArgs: entry.acceptsArgs } : {}),
      handler: (ctx: PluginCommandContext) => entry.handler(ctx, deps),
    });
  }
}

// Serialize the advertised manifest (wire format v:1). Byte-stable: JSON
// key order follows construction order, which is fixed by the table.
// Array order is the client's ranking priority.
export function buildCommandManifestJson(): string {
  const commands = TLON_COMMAND_REGISTRY.flatMap((entry) => {
    if (entry.manifest === false) {
      return [];
    }
    const wireEntry: Record<string, unknown> = {
      command: `/${entry.name}`,
      title: entry.manifest.title,
    };
    if (entry.manifest.subtitle !== undefined) {
      wireEntry.subtitle = entry.manifest.subtitle;
    }
    if (entry.manifest.keywords !== undefined) {
      wireEntry.keywords = entry.manifest.keywords;
    }
    if (entry.manifest.insertText !== undefined) {
      wireEntry.insertText = entry.manifest.insertText;
    }
    return [wireEntry];
  });

  const value = JSON.stringify({ v: 1, commands });
  const bytes = new TextEncoder().encode(value).byteLength;
  if (bytes > BOT_COMMANDS_MAX_MANIFEST_BYTES) {
    throw new Error(
      `bot command manifest exceeds ${BOT_COMMANDS_MAX_MANIFEST_BYTES} UTF-8 bytes: ${bytes}`
    );
  }
  return value;
}
