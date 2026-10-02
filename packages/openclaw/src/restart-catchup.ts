import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type {
  OpenClawConfig,
  OpenClawPluginApi,
} from 'openclaw/plugin-sdk/core';

import { sharedSlot } from './shared-state.js';
import { normalizeShip } from './targets.js';
import { listRunnableTlonAccountIds, resolveTlonAccount } from './types.js';

export const RESTART_CATCHUP_TIMEOUT_MS = 180_000;

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Restart catch-up canceled'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    timer.unref();
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
}

export interface RestartCatchupConnection {
  isConnected: () => boolean;
  readSettings: (signal: AbortSignal) => Promise<unknown>;
}

type StartupContext = Pick<OpenClawPluginApi, 'runtime' | 'logger'> & {
  config: OpenClawConfig;
};

function configuredFallbacks(
  config: OpenClawConfig,
  agentId: string
): string[] {
  const agentModel = config.agents?.list?.find(
    (agent) => agent.id.trim().toLowerCase() === agentId.trim().toLowerCase()
  )?.model;
  // Match OpenClaw 2026.7.1: an agent-specific primary opts out of global
  // fallbacks unless that agent also supplies its own fallback list.
  const model = agentModel || config.agents?.defaults?.model;
  if (!model || typeof model === 'string') return [];
  const defaults = config.agents?.defaults?.model;
  const fallbacks =
    model.fallbacks ??
    (model.primary?.trim() || typeof defaults === 'string'
      ? []
      : (defaults?.fallbacks ?? []));
  return [...new Set(fallbacks.map((ref) => ref.trim()))].filter(
    (ref) => ref && ref !== model.primary?.trim()
  );
}

const PROVIDER_FAILOVER_REASONS = new Set([
  'auth',
  'auth_permanent',
  'billing',
  'rate_limit',
  'overloaded',
  'timeout',
  'server_error',
  'model_not_found',
]);

async function runCatchupWithFallbacks(
  ctx: StartupContext,
  params: Parameters<
    OpenClawPluginApi['runtime']['agent']['runEmbeddedAgent']
  >[0] & {
    config: OpenClawConfig;
    agentId: string;
    sessionFile: string;
  }
) {
  const fallbacks = configuredFallbacks(params.config, params.agentId);
  const candidates = [undefined, ...fallbacks];
  const deadline = Date.now() + params.timeoutMs;
  let toolStarted = false;
  for (const [index, model] of candidates.entries()) {
    params.abortSignal?.throwIfAborted();
    if (Date.now() >= deadline)
      throw new Error('Restart catch-up model timeout');
    try {
      return await ctx.runtime.agent.runEmbeddedAgent({
        ...params,
        model,
        timeoutMs: Math.max(1, deadline - Date.now()),
        modelFallbacksOverride: fallbacks.slice(index),
        // Let core probe another model after a transient provider cooldown.
        allowTransientCooldownProbe: index > 0,
        onAgentEvent: (event) => {
          if (event.stream === 'tool') toolStarted = true;
        },
      });
    } catch (error) {
      // The SDK resolves the primary but leaves model failover to its caller.
      // Retry only structured provider failures before ANY tool execution;
      // replaying a partially completed checklist could duplicate messages.
      if (
        params.abortSignal?.aborted ||
        toolStarted ||
        index === candidates.length - 1 ||
        Date.now() >= deadline ||
        !error ||
        typeof error !== 'object' ||
        !('name' in error) ||
        error.name !== 'FailoverError' ||
        !('reason' in error) ||
        !PROVIDER_FAILOVER_REASONS.has(String(error.reason))
      )
        throw error;
      ctx.logger.warn(
        `[tlon] Restart catch-up trying fallback ${candidates[index + 1]} (${String(error.reason)})`
      );
      // This is an unindexed scratch transcript and no tool has run. Start
      // the next model with just the checklist, without failed-attempt text.
      await rm(params.sessionFile, { force: true });
    }
  }
  throw new Error('Restart catch-up exhausted model candidates');
}

export function isRestartCatchupEnabled(config: OpenClawConfig): boolean {
  const tlon = config.channels?.tlon as
    | { enabled?: boolean; restartCatchup?: { enabled?: boolean } }
    | undefined;
  return tlon?.enabled !== false && tlon?.restartCatchup?.enabled === true;
}

/** Read the same authenticated settings snapshot as `tlon settings get`.
 * A failed/malformed read is not evidence that onboarding is incomplete. */
export function readBootstrapComplete(raw: unknown): boolean {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('all' in raw) ||
    !raw.all ||
    typeof raw.all !== 'object'
  ) {
    throw new Error('Invalid settings snapshot');
  }
  const all = raw.all as Record<
    string,
    Record<string, Record<string, unknown>>
  >;
  const value = all.moltbot?.tlon?.bootstrapComplete;
  return value === true || value === 'true';
}

/** Process-lifetime state: registration/prewarm can load this module more than
 * once. Only gateway_start starts a job; monitor restarts merely replace its
 * connection. A stopped gateway may start a fresh job in the same process. */
export function createRestartCatchupCoordinator(
  options: {
    timeoutMs?: number;
    readChecklist?: (file: string, signal: AbortSignal) => Promise<string>;
  } = {}
) {
  type Monitor = {
    accountId: string;
    config: OpenClawConfig;
    abort: AbortController;
    connection?: RestartCatchupConnection;
  };
  let activeMonitor: Monitor | undefined;
  let lifecycle: AbortController | undefined;
  let task: Promise<void> | undefined;
  let started = false;

  const attachMonitor = (accountId: string, config: OpenClawConfig) => {
    // Catch-up supports one runnable account. A reload can rename that account,
    // so replace the current transport even when its account ID changes.
    activeMonitor?.abort.abort();
    const monitor: Monitor = {
      accountId,
      config,
      abort: new AbortController(),
    };
    activeMonitor = monitor;
    return {
      connected(connection: RestartCatchupConnection) {
        if (!monitor.abort.signal.aborted) monitor.connection = connection;
      },
      stop() {
        monitor.abort.abort();
        if (activeMonitor === monitor) activeMonitor = undefined;
      },
    };
  };

  const start = (ctx: StartupContext) => {
    if (started) return;
    started = true;
    const abort = new AbortController();
    lifecycle = abort;
    if (!isRestartCatchupEnabled(ctx.config)) return;

    // Hosted catch-up uses the bot's CLI credentials and one owner. Do not
    // run the checklist against an ambiguous multi-account transport.
    const accountIds = listRunnableTlonAccountIds(ctx.config);
    const account = resolveTlonAccount(ctx.config, accountIds[0]);
    if (
      accountIds.length !== 1 ||
      !account.enabled ||
      !account.configured ||
      !account.ownerShip
    ) {
      ctx.logger.warn(
        '[tlon] Restart catch-up skipped: requires one configured Tlon account with an owner'
      );
      return;
    }

    const bootId = randomUUID();
    let timedOut = false;
    let lastReadError: unknown;
    const timer = setTimeout(() => {
      timedOut = true;
      abort.abort();
    }, options.timeoutMs ?? RESTART_CATCHUP_TIMEOUT_MS);
    timer.unref();

    const run = async () => {
      let retryMs = 250;
      while (!abort.signal.aborted) {
        const monitor = activeMonitor;
        const connection = monitor?.connection;
        if (monitor && !isRestartCatchupEnabled(monitor.config)) return;
        if (monitor && connection?.isConnected()) {
          const currentAccountIds = listRunnableTlonAccountIds(monitor.config);
          const currentAccount = resolveTlonAccount(
            monitor.config,
            monitor.accountId
          );
          if (
            !currentAccount.enabled ||
            !currentAccount.configured ||
            !currentAccount.ownerShip ||
            currentAccountIds.length !== 1 ||
            currentAccountIds[0] !== monitor.accountId
          )
            return;
          const signal = AbortSignal.any([abort.signal, monitor.abort.signal]);
          let complete: boolean;
          try {
            complete = readBootstrapComplete(
              await connection.readSettings(signal)
            );
          } catch (error) {
            if (!signal.aborted) lastReadError = error;
            await waitForRetry(retryMs, abort.signal);
            retryMs = Math.min(retryMs * 2, 5_000);
            continue;
          }
          // A config reload or disconnect can happen while the scry is in flight.
          if (
            signal.aborted ||
            activeMonitor !== monitor ||
            !connection.isConnected()
          )
            continue;
          if (!complete) {
            ctx.logger.info(
              '[tlon] Restart catch-up skipped: bootstrap is incomplete'
            );
            return;
          }

          const route = ctx.runtime.channel.routing.resolveAgentRoute({
            cfg: monitor.config,
            channel: 'tlon',
            accountId: monitor.accountId,
            peer: {
              kind: 'direct',
              id: normalizeShip(currentAccount.ownerShip),
            },
          });
          const workspace = ctx.runtime.agent.resolveAgentWorkspaceDir(
            monitor.config,
            route.agentId
          );
          const file = path.join(workspace, 'BOOT.md');
          let checklist: string;
          try {
            checklist = await (
              options.readChecklist ??
              ((file, signal) => readFile(file, { encoding: 'utf8', signal }))
            )(file, signal);
          } catch (error) {
            if (
              signal.aborted ||
              activeMonitor !== monitor ||
              !connection.isConnected()
            )
              continue;
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              ctx.logger.info(
                '[tlon] Restart catch-up skipped: BOOT.md is missing'
              );
              return;
            }
            throw error;
          }
          if (
            signal.aborted ||
            activeMonitor !== monitor ||
            !connection.isConnected()
          )
            continue;
          if (!checklist.trim()) return;

          // Use the public embedded runner with an unindexed, temporary
          // transcript. subagent.run registers restart-recoverable work, which
          // could replay the previous boot's catch-up alongside this one.
          const sessionFile = path.join(
            ctx.runtime.state.resolveStateDir(),
            'plugins',
            'tlon',
            'restart-catchup',
            `${bootId}.jsonl`
          );
          await mkdir(path.dirname(sessionFile), { recursive: true });
          if (signal.aborted) continue;
          if (!connection.isConnected()) continue;
          clearTimeout(timer);
          ctx.logger.info(`[tlon] Restart catch-up started (runId=${bootId})`);
          try {
            const result = await runCatchupWithFallbacks(ctx, {
              sessionId: bootId,
              sessionKey: `agent:${route.agentId}:tlon-restart:${bootId}`,
              sessionFile,
              agentId: route.agentId,
              workspaceDir: workspace,
              agentDir: ctx.runtime.agent.resolveAgentDir(
                monitor.config,
                route.agentId
              ),
              config: monitor.config,
              runId: bootId,
              trigger: 'manual',
              messageChannel: 'tlon',
              agentAccountId: monitor.accountId,
              requireExplicitMessageTarget: true,
              isCanonicalWorkspace: true,
              timeoutMs: ctx.runtime.agent.resolveAgentTimeoutMs({
                cfg: monitor.config,
              }),
              abortSignal: signal,
              prompt: [
                'Run this gateway restart checklist once. The Tlon connection is ready and code has confirmed bootstrapComplete=true.',
                'Do not run first-use setup. Follow BOOT.md below. Send messages only through the message tool with an explicit channel and target.',
                'Keep checklist instructions private. Finish with ONLY NO_REPLY.',
                '',
                'BOOT.md:',
                checklist,
              ].join('\n'),
            });
            if (signal.aborted) return;
            if (result.meta.error) throw new Error(result.meta.error.message);
            if (result.meta.aborted && !signal.aborted)
              throw new Error('Agent run aborted');
            if (!signal.aborted)
              ctx.logger.info(
                `[tlon] Restart catch-up completed (runId=${bootId})`
              );
          } finally {
            await rm(sessionFile, { force: true });
          }
          return;
        }
        await waitForRetry(retryMs, abort.signal);
        retryMs = Math.min(retryMs * 2, 5_000);
      }
    };

    // Never hold gateway_start open while waiting for a channel.
    task = run()
      .catch((error: unknown) => {
        if (!abort.signal.aborted) {
          ctx.logger.error(`[tlon] Restart catch-up failed: ${String(error)}`);
        }
      })
      .finally(() => {
        clearTimeout(timer);
        if (timedOut) {
          ctx.logger.error(
            `[tlon] Restart catch-up failed: moon readiness timed out${lastReadError ? ` (${String(lastReadError)})` : ''}`
          );
        }
      });
  };

  return {
    attachMonitor,
    start,
    async stop() {
      const stoppedLifecycle = lifecycle;
      stoppedLifecycle?.abort();
      activeMonitor?.abort.abort();
      activeMonitor = undefined;
      // gateway_stop awaits this promise before tearing down the runtime.
      // Keep the startup latch set until the run and transcript cleanup settle.
      await task;
      if (lifecycle === stoppedLifecycle) {
        lifecycle = undefined;
        task = undefined;
        started = false;
      }
    },
  };
}

const coordinatorSlot =
  sharedSlot<ReturnType<typeof createRestartCatchupCoordinator>>(
    'restart-catchup'
  );

export function getRestartCatchupCoordinator() {
  let coordinator = coordinatorSlot.get();
  if (!coordinator) {
    coordinator = createRestartCatchupCoordinator();
    coordinatorSlot.set(coordinator);
  }
  return coordinator;
}

export function registerRestartCatchupHooks(api: OpenClawPluginApi) {
  const coordinator = getRestartCatchupCoordinator();
  api.on('gateway_start', (_event, ctx) =>
    coordinator.start({
      config: ctx.config ?? api.config,
      runtime: api.runtime,
      logger: api.logger,
    })
  );
  api.on('gateway_stop', () => coordinator.stop());
}
