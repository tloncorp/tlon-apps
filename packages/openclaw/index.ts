import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineChannelPluginEntry } from 'openclaw/plugin-sdk/core';

import { tlonPlugin } from './src/channel.js';
import { publishContextLensEvent } from './src/context-lens-events.js';
import { registerContextLensRoutes } from './src/context-lens-routes.js';
import { initContextLensShipSync } from './src/context-lens-ship-sync.js';
import { initContextLensStore } from './src/context-lens-store.js';
import {
  ensureBackgroundContextLensForSession,
  recordContextLensToolResultForSession,
  recordContextLensToolStartForSession,
  scheduleBackgroundContextLensFinalization,
} from './src/context-lens.js';
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

function readToolCallId(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') {
    return undefined;
  }
  const value =
    (
      event as {
        toolCallId?: unknown;
        callId?: unknown;
        id?: unknown;
      }
    ).toolCallId ??
    (event as { callId?: unknown }).callId ??
    (event as { id?: unknown }).id;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
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
const DEFAULT_TLON_CLI_TIMEOUT_MS = 45_000;

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

function summarizeToolParams(params: unknown): string | undefined {
  if (params === null || params === undefined) {
    return undefined;
  }
  if (Array.isArray(params)) {
    return `${params.length} array item${params.length === 1 ? '' : 's'}`;
  }
  if (typeof params === 'object') {
    const keys = Object.keys(params);
    if (!keys.length) {
      return 'empty object';
    }
    const shown = keys.slice(0, 4).join(', ');
    const suffix = keys.length > 4 ? ` +${keys.length - 4}` : '';
    return `${keys.length} key${keys.length === 1 ? '' : 's'}: ${shown}${suffix}`;
  }
  return typeof params;
}

const MAX_TOOL_PARAM_DETAIL_CHARS = 2000;

function detailToolParams(params: unknown): string | undefined {
  if (params === null || params === undefined) {
    return undefined;
  }
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(params, null, 1);
  } catch {
    return undefined;
  }
  if (!serialized) {
    return undefined;
  }
  if (serialized.length > MAX_TOOL_PARAM_DETAIL_CHARS) {
    return `${serialized.slice(0, MAX_TOOL_PARAM_DETAIL_CHARS)}… [truncated]`;
  }
  return serialized;
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
  credentials?: { url: string; ship: string; code: string },
  timeoutMs = DEFAULT_TLON_CLI_TIMEOUT_MS
): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (credentials) {
      env.URBIT_SHIP = credentials.ship;
      env.URBIT_URL = credentials.url;
      env.URBIT_CODE = credentials.code;
    }

    const child = spawn(binary, args, { env });
    let settled = false;
    let killTimer: NodeJS.Timeout | null = null;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 2_000);
      reject(new Error(`tlon command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (killTimer) {
        clearTimeout(killTimer);
      }
      reject(new Error(`Failed to run tlon: ${err.message}`));
    });

    child.on('close', (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (killTimer) {
        clearTimeout(killTimer);
      }
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

    const contextLensRoutesEnabled = registerContextLensRoutes(api);
    const contextLensShipSyncEnabled = initContextLensShipSync(api);
    // Recording and the disk store run when at least one reader path is
    // live: authed gateway routes or %context-lens ship sync.
    const contextLensEnabled =
      contextLensRoutesEnabled || contextLensShipSyncEnabled;
    if (contextLensEnabled) {
      initContextLensStore(api);
    }

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
    const toolTimeoutMs =
      account.lifecycle.toolTimeoutMs ?? DEFAULT_TLON_CLI_TIMEOUT_MS;

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

          const output = await runTlonCommand(
            tlonBinary,
            args,
            credentials,
            toolTimeoutMs
          );
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
      const toolCallId = readToolCallId(event);
      const role = getSessionRole(ctx.sessionKey ?? '');
      const isOwnerOnlyTool = ownerOnlyTools.has(event.toolName);
      const isBlocked = isOwnerOnlyTool && role === 'user';
      const blockReason = isBlocked
        ? `The ${event.toolName} tool is not available.`
        : undefined;
      if (contextLensEnabled) {
        // Capture tool activity even when no conversation run owns this
        // session (cron wakes — including jobs that reuse the main session
        // and so inherit a sender-role entry — heartbeats, subagents).
        // No-ops when a conversation lens is already bound.
        const isCronSession = (ctx.sessionKey ?? '').includes(':cron:');
        const background = ensureBackgroundContextLensForSession(
          ctx.sessionKey,
          {
            runKind: isCronSession ? 'cron' : 'internal',
            trigger: isCronSession ? 'cron' : 'tool',
            preview: `${event.toolName} tool activity`,
          }
        );
        if (background?.created) {
          publishContextLensEvent('created', background.lens);
        }
        const lens = recordContextLensToolStartForSession(
          ctx.sessionKey,
          event.toolName,
          {
            phase: 'before',
            argumentSummary: summarizeToolParams(event.params),
            argumentDetail: detailToolParams(event.params),
            toolCallId,
          }
        );
        if (lens) {
          publishContextLensEvent('tool_start', lens, {
            toolName: event.toolName,
            ...(toolCallId ? { toolCallId } : {}),
            toolPhase: 'before',
            toolCallCount: lens.tools.callCount,
          });
        }
      }

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
        return undefined;
      }

      // Allow owner sessions and internal sessions (heartbeat, cron, etc.).
      // Internal sessions have no role because they're not triggered by DMs.
      // Only block when role is explicitly "user" (non-owner DM).
      if (isBlocked) {
        api.logger.warn(
          `[tlon] Blocked ${event.toolName} tool for non-owner. Session: ${ctx.sessionKey}, Role: ${role}`
        );
        if (contextLensEnabled) {
          const blockedLens = recordContextLensToolResultForSession(
            ctx.sessionKey,
            event.toolName,
            {
              error: blockReason,
              status: 'blocked',
              toolCallId,
            }
          );
          if (blockedLens) {
            publishContextLensEvent('tool_result', blockedLens, {
              toolName: event.toolName,
              ...(toolCallId ? { toolCallId } : {}),
              toolPhase: 'blocked',
              toolCallCount: blockedLens.tools.callCount,
            });
            scheduleBackgroundContextLensFinalization(
              ctx.sessionKey,
              (finalLens) => {
                publishContextLensEvent('final', finalLens);
              }
            );
          }
        }
        return {
          block: true,
          blockReason,
        };
      }

      api.logger.info(
        `[tlon] Allowed ${event.toolName} tool for ${role ?? 'internal'} session. Session: ${ctx.sessionKey}`
      );
      return undefined;
    });

    api.on('after_tool_call', (event, ctx) => {
      const toolCallId = readToolCallId(event);
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
      if (contextLensEnabled) {
        const lens = recordContextLensToolResultForSession(
          ctx.sessionKey,
          event.toolName,
          {
            durationMs: event.durationMs,
            error: event.error,
            toolCallId,
          }
        );
        if (lens) {
          publishContextLensEvent('tool_result', lens, {
            toolName: event.toolName,
            ...(toolCallId ? { toolCallId } : {}),
            toolPhase: 'after',
            toolCallCount: lens.tools.callCount,
          });
          scheduleBackgroundContextLensFinalization(
            ctx.sessionKey,
            (finalLens) => {
              publishContextLensEvent('final', finalLens);
            }
          );
        }
      }
    });

    // Cron jobs can run inside the main session, where the session key has
    // no `:cron:` marker — the agent-level hook context is the only place
    // the gateway exposes the cron trigger, so tag the run's lens here
    // before any tool fires. Idempotent across both hooks.
    const ensureCronContextLens = (ctx: {
      sessionKey?: string;
      trigger?: string;
      jobId?: string;
    }) => {
      if (!contextLensEnabled || ctx.trigger !== 'cron') {
        return;
      }
      const background = ensureBackgroundContextLensForSession(ctx.sessionKey, {
        runKind: 'cron',
        trigger: 'cron',
        preview: ctx.jobId ? `cron job ${ctx.jobId}` : 'cron run',
      });
      if (background?.created) {
        publishContextLensEvent('created', background.lens);
      }
    };
    api.on('agent_turn_prepare', (_event, ctx) => ensureCronContextLens(ctx));
    api.on('model_call_started', (_event, ctx) => ensureCronContextLens(ctx));

    // Background lenses normally finalize on tool-result idle; agent_end
    // re-arms the window so runs that end with model output (no trailing
    // tool call) still finalize, while leaving time for the gateway to
    // deliver the reply (stamped + recorded via the outbound send path).
    api.on('agent_end', (_event, ctx) => {
      if (!contextLensEnabled) {
        return;
      }
      scheduleBackgroundContextLensFinalization(ctx.sessionKey, (finalLens) => {
        publishContextLensEvent('final', finalLens);
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
