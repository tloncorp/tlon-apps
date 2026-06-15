import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/core';

import { tlonPlugin } from './src/channel.js';
import { sendGatewayStop } from './src/gateway-status.js';
import {
  createGatewayStatusManager,
  setGatewayStatusManager,
} from './src/gateway-status.js';
import { resolveBridgeForCommand } from './src/monitor/command-auth.js';
import { handleOwnerListenCommand } from './src/owner-listen-command.js';
import { setTlonRuntime } from './src/runtime.js';
import { getSessionRole } from './src/session-roles.js';
import { recordToolCall } from './src/telemetry.js';
import { resolveTlonBinary } from './src/tlon-binary.js';
import { checkBlockedSendOperation } from './src/tlon-tool-guard.js';
import {
  formatToolTraceEvent,
  liveToolTraceContentsEnabled,
  shouldLogAfterToolTrace,
} from './src/tool-trace.js';
import { listTlonAccountIds, resolveTlonAccount } from './src/types.js';
import { PLUGIN_COMMIT, PLUGIN_VERSION } from './src/version.generated.js';

export { tlonPlugin } from './src/channel.js';
export { setTlonRuntime } from './src/runtime.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Whitelist of allowed tlon subcommands
const ALLOWED_TLON_COMMANDS = new Set([
  'activity',
  'channels',
  'contacts',
  'dms',
  'expose',
  'groups',
  'hooks',
  'messages',
  'notebook',
  'posts',
  'settings',
  'upload',
  'help',
  'version',
]);

/** Credential flags that the tlon skill binary accepts before the subcommand. */
const CREDENTIAL_FLAGS_WITH_VALUE = new Set([
  '--config',
  '--url',
  '--ship',
  '--code',
  '--cookie',
]);

/**
 * Find the first positional argument (subcommand) by skipping credential flags
 * and their values. Returns the index into `args`, or -1 if none found.
 */
function findSubcommandIndex(args: string[]): number {
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    // --flag=value form: skip one token
    if (arg.startsWith('--') && arg.includes('=')) {
      const flag = arg.slice(0, arg.indexOf('='));
      if (CREDENTIAL_FLAGS_WITH_VALUE.has(flag)) {
        i += 1;
        continue;
      }
    }
    // --flag value form: skip two tokens
    if (CREDENTIAL_FLAGS_WITH_VALUE.has(arg)) {
      i += 2;
      continue;
    }
    // Not a credential flag — this is the subcommand
    return i;
  }
  return -1;
}

/**
 * Shell-like argument splitter that respects quotes
 */
function shellSplit(str: string): string[] {
  const args: string[] = [];
  let cur = '';
  let inDouble = false;
  let inSingle = false;
  let escape = false;

  for (const ch of str) {
    if (escape) {
      cur += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      escape = true;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (/\s/.test(ch) && !inDouble && !inSingle) {
      if (cur) {
        args.push(cur);
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur) {
    args.push(cur);
  }
  return args;
}

/**
 * Run the tlon command and return the result
 */
function runTlonCommand(
  binary: string,
  args: string[],
  credentials?: { url: string; ship: string; code: string }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (credentials) {
      env.URBIT_SHIP = credentials.ship;
      env.URBIT_URL = credentials.url;
      env.URBIT_CODE = credentials.code;
    }

    const child = spawn(binary, args, { env });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to run tlon: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `tlon exited with code ${code}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

export default defineChannelPluginEntry({
  id: 'tlon',
  name: 'Tlon',
  description: 'Tlon/Urbit channel plugin',
  plugin: tlonPlugin,
  setRuntime: setTlonRuntime,
  registerFull(api) {
    // ── Gateway-status liveness integration ───────────────────
    //
    // v1 requires exactly one Tlon account. With multiple accounts, multiple
    // monitors call configureTlonApiWithPoke() and the last one wins the
    // global @tloncorp/api singleton — making it unsafe to route heartbeats or
    // stop pokes to a specific ship. Disable entirely rather than route to the
    // wrong ship.
    //
    // We count ALL configured account entries (not just currently-runnable
    // ones) on purpose. The manager is a process-lifetime singleton created
    // here in registerFull, which does NOT re-run on config reload. If we
    // counted only runnable accounts, a config of one complete account plus a
    // disabled/unconfigured stub would enable the singleton, and later
    // completing the stub would start a second monitor that races the shared
    // API slot — without registerFull re-evaluating the gate. Counting every
    // entry keeps the feature off whenever a second account exists at all.
    const gsAccountIds = listTlonAccountIds(api.config);
    setGatewayStatusManager(null);

    if (gsAccountIds.length > 1) {
      api.logger.warn(
        `[gateway-status] disabled: ${gsAccountIds.length} Tlon accounts configured, ` +
          `but v1 only supports one (global @tloncorp/api client cannot target multiple ships)`
      );
    } else if (gsAccountIds.length === 1) {
      const gsManager = createGatewayStatusManager({
        logger: {
          log: (m) => api.logger.info(m),
          error: (m) => api.logger.warn(m),
        },
      });
      setGatewayStatusManager(gsManager);

      api.on('gateway_start', () => {
        gsManager.signalGatewayStarted();
        api.logger.info('[gateway-status] gateway_start received');
      });

      api.on('gateway_stop', async (event) => {
        if (gsManager.stopped) {
          return;
        }
        // Latch stopped FIRST, unconditionally. An activation task may be
        // in flight (between the %gateway-start poke and markActivated());
        // latching here makes its post-poke recheck bail so it can't start a
        // heartbeat after we've already passed the shutdown hook.
        const startPokeInFlightOrDone =
          gsManager.activated || gsManager.starting;
        gsManager.stopHeartbeat();
        gsManager.markStopped();
        // Only send %gateway-stop if a %gateway-start has been or is being
        // sent. If activation never reached the start poke, there is nothing
        // for the ship to stop.
        if (!startPokeInFlightOrDone) {
          return;
        }
        try {
          const sent = await sendGatewayStop({
            bootId: gsManager.bootId,
            reason: event.reason ?? 'shutdown',
          });
          if (sent) {
            api.logger.info(
              `[gateway-status] stopped (reason=${event.reason ?? 'shutdown'})`
            );
          } else {
            api.logger.warn(
              '[gateway-status] stop skipped: api-client params not published'
            );
          }
        } catch (err) {
          api.logger.warn(`[gateway-status] stop poke failed: ${String(err)}`);
        }
      });
    }
    // else: zero accounts configured — nothing to do

    // Register /tlon-version command
    api.registerCommand({
      name: 'tlon-version',
      description: 'Show Tlon plugin version.',
      handler: async () => {
        return { text: `Tlon plugin v${PLUGIN_VERSION} (${PLUGIN_COMMIT})` };
      },
    });

    // Register the tlon tool
    const tlonBinary = resolveTlonBinary({
      moduleDir: __dirname,
      resolveModule: require.resolve,
      log: (msg) => api.logger.debug?.(msg),
    });
    api.logger.info(`[tlon] Registering tlon tool, binary: ${tlonBinary}`);

    // Capture credentials from config at registration time
    const account = resolveTlonAccount(api.config);
    const credentials =
      account.configured && account.url && account.ship && account.code
        ? { url: account.url, ship: account.ship, code: account.code }
        : undefined;

    if (credentials) {
      api.logger.info(`[tlon] Credentials available for ${account.ship}`);
    } else {
      api.logger.warn(
        `[tlon] No credentials configured - tlon tool will rely on env vars`
      );
    }

    api.registerTool({
      name: 'tlon',
      label: 'Tlon CLI',
      description:
        'Tlon/Urbit API for reading data and administration: activity, channels, contacts, groups, messages, posts, settings, upload, expose, hooks. ' +
        'DO NOT use this tool to send messages — use the `message` tool instead. ' +
        "Examples: 'activity mentions --limit 10', 'channels groups', 'contacts self', 'groups list'",
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description:
              'The tlon command and arguments (read/admin operations). ' +
              'To send messages, use the `message` tool, not this tool. ' +
              "Examples: 'activity mentions --limit 10', 'contacts get ~sampel-palnet', 'groups list', 'messages dm ~ship --limit 20'",
          },
        },
        required: ['command'],
      },
      async execute(_id: string, params: { command: string }) {
        try {
          const args = shellSplit(params.command);

          const subIdx = findSubcommandIndex(args);
          const subcommand = subIdx >= 0 ? args[subIdx] : undefined;
          if (!subcommand || !ALLOWED_TLON_COMMANDS.has(subcommand)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error: Unknown tlon subcommand '${subcommand ?? '(none)'}'. Allowed: ${[...ALLOWED_TLON_COMMANDS].join(', ')}`,
                },
              ],
              details: { error: true },
            };
          }

          // Check for blocked send operations (uses args from subcommand onward)
          const blocked = checkBlockedSendOperation(args.slice(subIdx));
          if (blocked) {
            return {
              content: [{ type: 'text' as const, text: blocked }],
              details: { blocked: true, reason: 'send_operation' },
            };
          }

          const output = await runTlonCommand(tlonBinary, args, credentials);
          return {
            content: [{ type: 'text' as const, text: output }],
            details: undefined,
          };
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text' as const, text: `Error: ${message}` }],
            details: { error: true },
          };
        }
      },
    });

    // Tool access control: block sensitive tools for non-owners
    const ownerOnlyTools = new Set(['tlon', 'cron', 'read']);
    const logToolTraceContents = liveToolTraceContentsEnabled();

    api.on('before_tool_call', (event, ctx) => {
      const role = getSessionRole(ctx.sessionKey ?? '');
      const isOwnerOnlyTool = ownerOnlyTools.has(event.toolName);
      const isBlocked = isOwnerOnlyTool && role === 'user';
      const blockReason = isBlocked
        ? `The ${event.toolName} tool is not available.`
        : undefined;

      if (logToolTraceContents) {
        api.logger.info(
          formatToolTraceEvent({
            phase: 'before',
            sessionKey: ctx.sessionKey,
            toolName: event.toolName,
            payload: {
              params: event.params,
              role: role ?? 'internal',
              blocked: isBlocked,
              ...(blockReason ? { blockReason } : {}),
            },
          })
        );
      }

      if (!isOwnerOnlyTool) {
        return;
      }

      // Allow owner sessions and internal sessions (heartbeat, cron, etc.).
      // Internal sessions have no role because they're not triggered by DMs.
      // Only block when role is explicitly "user" (non-owner DM).
      if (isBlocked) {
        api.logger.warn(
          `[tlon] Blocked ${event.toolName} tool for non-owner. Session: ${ctx.sessionKey}, Role: ${role}`
        );
        return {
          block: true,
          blockReason,
        };
      }

      api.logger.info(
        `[tlon] Allowed ${event.toolName} tool for ${role ?? 'internal'} session. Session: ${ctx.sessionKey}`
      );
    });

    api.on('after_tool_call', (event, ctx) => {
      if (logToolTraceContents && shouldLogAfterToolTrace(event)) {
        api.logger.info(
          formatToolTraceEvent({
            phase: 'after',
            sessionKey: ctx.sessionKey,
            toolName: event.toolName,
            payload: {
              params: event.params,
              result: event.result,
              error: event.error ?? null,
              durationMs: event.durationMs ?? null,
            },
          })
        );
      }

      recordToolCall({
        sessionKey: ctx.sessionKey,
        toolName: event.toolName,
        durationMs: event.durationMs,
        error: event.error,
      });
    });

    // ── Slash commands for approval & admin ────────────────────────────
    api.registerCommand({
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
    });

    api.registerCommand({
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
    });

    api.registerCommand({
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
    });

    api.registerCommand({
      name: 'pending',
      description: 'List pending approval requests',
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return { text: await result.bridge.getPendingList() };
      },
    });

    api.registerCommand({
      name: 'banned',
      description: 'List banned ships',
      handler: async (ctx) => {
        const result = resolveBridgeForCommand(ctx);
        if ('error' in result) {
          return { text: result.error };
        }
        return { text: await result.bridge.getBlockedList() };
      },
    });

    api.registerCommand({
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
    });

    api.registerCommand({
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
    });
  },
});
