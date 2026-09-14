import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import type {
  OpenClawConfig,
  OpenClawPluginApi,
} from 'openclaw/plugin-sdk/core';

import { sharedSlot } from './shared-state.js';
import { listTlonAccountIds, resolveTlonAccount } from './types.js';

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
    config: OpenClawConfig;
    abort: AbortController;
    connection?: RestartCatchupConnection;
  };
  const monitors = new Map<string, Monitor>();
  let lifecycle: AbortController | undefined;
  let started = false;

  const attachMonitor = (accountId: string, config: OpenClawConfig) => {
    monitors.get(accountId)?.abort.abort();
    const monitor: Monitor = { config, abort: new AbortController() };
    monitors.set(accountId, monitor);
    return {
      connected(connection: RestartCatchupConnection) {
        if (!monitor.abort.signal.aborted) monitor.connection = connection;
      },
      stop() {
        monitor.abort.abort();
        if (monitors.get(accountId) === monitor) monitors.delete(accountId);
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
    const accountIds = listTlonAccountIds(ctx.config);
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
        const monitor = monitors.get(account.accountId);
        const connection = monitor?.connection;
        if (monitor && !isRestartCatchupEnabled(monitor.config)) return;
        if (monitor && connection?.isConnected()) {
          const currentAccount = resolveTlonAccount(
            monitor.config,
            account.accountId
          );
          if (
            !currentAccount.enabled ||
            !currentAccount.ownerShip ||
            listTlonAccountIds(monitor.config).length !== 1
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
            monitors.get(account.accountId) !== monitor ||
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
            accountId: account.accountId,
            peer: { kind: 'direct', id: currentAccount.ownerShip },
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
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              ctx.logger.info(
                '[tlon] Restart catch-up skipped: BOOT.md is missing'
              );
              return;
            }
            if (signal.aborted) continue;
            throw error;
          }
          if (
            signal.aborted ||
            monitors.get(account.accountId) !== monitor ||
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
          if (signal.aborted) return;
          if (!connection.isConnected()) continue;
          clearTimeout(timer);
          ctx.logger.info(`[tlon] Restart catch-up started (runId=${bootId})`);
          try {
            const result = await ctx.runtime.agent.runEmbeddedAgent({
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
              agentAccountId: account.accountId,
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
    void run()
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
    stop() {
      lifecycle?.abort();
      started = false;
      for (const monitor of monitors.values()) monitor.abort.abort();
      monitors.clear();
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
