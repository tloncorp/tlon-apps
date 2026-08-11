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
  handler: (
    ctx: PluginCommandContext,
    deps: TlonCommandDeps
  ) => Promise<PluginCommandResult>;
}

// The single source of truth for the plugin's slash commands: registration
// (index.ts registerFull) and the committed token fixture both derive from
// this table.
//
// The table carries no popup metadata (titles, subtitles, icons, keywords):
// the Tlon client owns the editorial surface, in its own static per-harness
// lists. What this side owes the client is the token set, and only that —
// which is what fixtures/commands.json holds and what the client's drift
// contract (packages/shared/src/domain/runtimeCommandContract.test.ts) pins
// against those lists.
//
// OpenClaw CORE commands (/status, /help, /new) are absent by construction:
// this plugin neither registers nor dispatches them. They are carried on the
// client's static list as audit-pinned constants.
export const TLON_COMMAND_REGISTRY: TlonCommandRegistryEntry[] = [
  {
    name: 'tlon-version',
    description: 'Show Tlon plugin version.',
    handler: async (_ctx, deps) => {
      return deps.renderTlonVersion();
    },
  },
  {
    name: 'tlon',
    description: 'Tlon plugin diagnostics. Usage: /tlon version',
    acceptsArgs: true,
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
// registration and the published token list cannot drift apart.
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

export function commandTokens(): string[] {
  return TLON_COMMAND_REGISTRY.map((entry) => `/${entry.name}`);
}

// The committed fixture's exact bytes (fixtures/commands.json). Nothing sends
// this anywhere: it is the CI artifact the client's drift contract reads, so
// only its content and its stability matter. Matches Python's
// `json.dumps(tokens, indent=2)` so both runtimes' fixtures look alike.
export function buildCommandTokensJson(): string {
  return `${JSON.stringify(commandTokens(), null, 2)}\n`;
}
