import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

import {
  budgetHoldPaths,
  readBudgetHoldState,
  readBudgetSignal,
  reconcileBudgetHolds,
  writeBudgetHoldState,
} from './cron-budget-hold.js';
import { getTlonCronService } from './cron-telemetry.js';
import { buildCreditIncreaseCard } from './credit-increase-request.js';
import { sharedSlot } from './shared-state.js';
import { captureTlonApiScope } from './urbit/api-client.js';

const notifier = sharedSlot<
  (message: string, blob?: string) => Promise<boolean>
>('cronBudget.notifier');
export function installBudgetHoldNotifier(
  send: (message: string, blob?: string) => Promise<boolean>
) {
  // Gateway timers run outside the monitor's authenticated async context.
  const runInMonitorScope = captureTlonApiScope();
  const scopedSend = runInMonitorScope
    ? (message: string, blob?: string) =>
        runInMonitorScope(() => send(message, blob))
    : send;
  notifier.set(scopedSend);
  return () => {
    if (notifier.get() === scopedSend) notifier.set(null);
  };
}

type Runner = { tick: () => Promise<void>; stop: () => Promise<void> };
const runnerSlot = sharedSlot<Runner>('cronBudget.runner');

/** Hosted-only. The wrapper supplies an explicit signal, never inferred from a model name. */
export function registerBudgetHoldHooks(
  api: Pick<OpenClawPluginApi, 'on' | 'logger'>
) {
  const paths = budgetHoldPaths();
  if (!paths) return;

  api.on('before_tool_call', async (event) => {
    if (event.toolName !== 'cron' || event.params.action !== 'run') return;
    const id = event.params.jobId ?? event.params.id;
    if (typeof id !== 'string') return;
    const state = await readBudgetHoldState(paths.state);
    if (Object.hasOwn(state.holds, id)) {
      return {
        block: true,
        blockReason:
          'This scheduled task is paused until the credit budget recovers.',
      };
    }
  });

  api.on('gateway_start', (_event, ctx) => {
    if (runnerSlot.get()) return;
    let flight: Promise<void> | undefined;
    let stopped = false;
    const tick = (): Promise<void> => {
      if (stopped) return Promise.resolve();
      if (flight) return flight;
      flight = (async () => {
        const cron = ctx.getCron?.() ?? getTlonCronService();
        if (!cron) return;
        const state = await readBudgetHoldState(paths.state);
        await reconcileBudgetHolds({
          budget: await readBudgetSignal(paths.signal),
          state,
          cron,
          save: () => writeBudgetHoldState(paths.state, state),
          notify: (message) =>
            notifier.get()?.(
              message,
              state.episodeId
                ? buildCreditIncreaseCard(message, state.episodeId)
                : undefined
            ) ?? Promise.resolve(false),
        });
      })()
        .catch((error) => {
          api.logger.warn(
            `[tlon] Cron budget hold reconciliation failed: ${String(error)}`
          );
        })
        .finally(() => {
          flight = undefined;
        });
      return flight;
    };
    const timer = setInterval(() => {
      void tick();
    }, 5_000);
    timer.unref();
    runnerSlot.set({
      tick,
      stop: async () => {
        stopped = true;
        clearInterval(timer);
        await flight;
      },
    });
    return tick();
  });
  // Do not await inside a cron mutation's hook. Reconciliation itself mutates
  // cron jobs; awaiting here could deadlock the host's mutation lock.
  api.on('cron_changed', (event) => {
    if (
      event.action === 'added' ||
      event.action === 'updated' ||
      event.action === 'removed'
    ) {
      void runnerSlot.get()?.tick();
    }
  });
  api.on('gateway_stop', async () => {
    const runner = runnerSlot.get();
    await runner?.stop();
    if (runnerSlot.get() === runner) runnerSlot.set(null);
  });
}
