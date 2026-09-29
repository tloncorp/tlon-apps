import { AsyncLocalStorage } from 'node:async_hooks';
import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

import {
  budgetHoldPaths,
  isRecurringJob,
  type BudgetCronService,
  type BudgetHoldState,
  readBudgetHoldState,
  readBudgetSignal,
  reconcileBudgetHolds,
  writeBudgetHoldState,
} from './cron-budget-hold.js';
import { createBudgetHoldObserver } from './cron-budget-observability.js';
import { getTlonCronService } from './cron-telemetry.js';
import { buildCreditIncreaseCard } from './credit-increase-request.js';
import { normalizeShip } from './targets.js';
import { listRunnableTlonAccountIds, resolveTlonAccount } from './types.js';
import { sharedMap, sharedSlot } from './shared-state.js';
import { captureTlonApiScope } from './urbit/api-client.js';

function recipientKey(accountId: string, config: OpenClawPluginApi['config']) {
  const account = resolveTlonAccount(config, accountId);
  return JSON.stringify([
    accountId,
    account.ship ? normalizeShip(account.ship) : null,
    account.ownerShip ? normalizeShip(account.ownerShip) : null,
  ]);
}

const notifiers = sharedMap<
  string,
  { key: string; send: (message: string, blob?: string) => Promise<boolean> }
>('cronBudget.notifiers');
const monitorConfig = sharedSlot<OpenClawPluginApi['config']>(
  'cronBudget.monitorConfig'
);
export function installBudgetHoldNotifier(
  accountId: string,
  send: (message: string, blob?: string) => Promise<boolean>,
  config: OpenClawPluginApi['config']
) {
  // Gateway timers run outside the monitor's authenticated async context.
  const runInMonitorScope = captureTlonApiScope();
  const scopedSend = runInMonitorScope
    ? (message: string, blob?: string) =>
        runInMonitorScope(() => send(message, blob))
    : send;
  const notifier = { key: recipientKey(accountId, config), send: scopedSend };
  notifiers.set(accountId, notifier);
  // Monitor restarts receive the host's current config, including accounts
  // added after gateway_start captured its original configuration.
  monitorConfig.set(config);
  return () => {
    if (notifiers.get(accountId) === notifier) notifiers.delete(accountId);
  };
}

type CronChange = { action: string; jobId: string };
type Runner = {
  getCron: () => BudgetCronService | undefined;
  tick: () => Promise<void>;
  changed: (event: CronChange) => void;
  stop: () => Promise<void>;
};
const runnerSlot = sharedSlot<Runner>('cronBudget.runner');

/** Hosted-only. The wrapper supplies an explicit signal, never inferred from a model name. */
/**
 * Blocks model-forced runs of budget-held recurring jobs. Registered from the
 * entry's registerCapabilities (see registerAgentTurnHooks in index.ts):
 * OpenClaw 2026.9.x dispatches before_tool_call inside a turn from a per-turn
 * registry that never sees registerFull, so a guard registered only there is
 * inert. Reads only shared state, so it works from any registration.
 */
export function registerBudgetRunGuard(api: Pick<OpenClawPluginApi, 'on'>) {
  const paths = budgetHoldPaths();
  if (!paths) return;

  api.on('before_tool_call', async (event) => {
    // 2026.9.x advertises the scheduler tool as `automations`; `cron` is the
    // legacy name it still accepts on inbound calls.
    if (
      (event.toolName !== 'automations' && event.toolName !== 'cron') ||
      event.params.action !== 'run'
    ) {
      return;
    }
    const id = event.params.jobId ?? event.params.id;
    if (typeof id !== 'string') return;
    const state = await readBudgetHoldState(paths.state);
    let blocked = Object.hasOwn(state.holds, id);
    if (!blocked) {
      const budget = await readBudgetSignal(paths.signal);
      const limited =
        budget === 'limited' || (budget === 'unknown' && state.limited);
      const cron = runnerSlot.get()?.getCron() ?? getTlonCronService();
      if (limited && cron) {
        const job = (await cron.list({ includeDisabled: true })).find(
          (job) => job.id === id
        );
        blocked = Boolean(job && isRecurringJob(job));
      }
    }
    if (blocked) {
      return {
        block: true,
        blockReason:
          'This scheduled task is paused until the credit budget recovers.',
      };
    }
  });
}

/** Gateway-lifetime budget hold machinery; registered from registerFull. */
export function registerBudgetHoldHooks(
  api: Pick<OpenClawPluginApi, 'on' | 'logger' | 'config'>
) {
  const paths = budgetHoldPaths();
  if (!paths) return;

  api.on('gateway_start', (_event, ctx) => {
    if (runnerSlot.get()) return;
    const observer = createBudgetHoldObserver(api.logger);
    const ownMutation = new AsyncLocalStorage<{ active: boolean }>();
    const pendingEdits = new Map<string, number>();
    let editGeneration = 0;
    let activeEdits: Set<string> | undefined;
    let flight: Promise<void> | undefined;
    let notificationFlight: Promise<void> | undefined;
    const deliveryReceipts: { episodeId: string; key: string }[] = [];
    // Merge delivery results into the latest ledger under the reconciliation
    // writer. A slow send must never retain a stale copy of hold ownership.
    const persistDeliveryReceipts = async (
      state: BudgetHoldState,
      config: OpenClawPluginApi['config']
    ) => {
      const count = deliveryReceipts.length;
      if (!count) return;
      for (const receipt of deliveryReceipts.slice(0, count)) {
        if (!state.limited || receipt.episodeId !== state.episodeId) continue;
        const received = (state.notifiedRecipients ??= []);
        if (!received.includes(receipt.key)) received.push(receipt.key);
      }
      const recipients = listRunnableTlonAccountIds(config).map((id) =>
        recipientKey(id, config)
      );
      state.notified =
        state.limited &&
        recipients.length > 0 &&
        recipients.every((key) => state.notifiedRecipients?.includes(key));
      if (state.notified) {
        delete state.notificationAttempts;
        delete state.nextNotificationAtMs;
      }
      await writeBudgetHoldState(paths.state, state);
      deliveryReceipts.splice(0, count);
    };
    let stopped = false;
    let rerun = false;
    const tick = (): Promise<void> => {
      if (stopped) return Promise.resolve();
      if (flight) {
        rerun = true;
        return flight;
      }
      flight = (async () => {
        const cron = ctx.getCron?.() ?? getTlonCronService();
        if (!cron) return;
        do {
          rerun = false;
          const edits = new Set(pendingEdits.keys());
          pendingEdits.clear();
          activeEdits = edits;
          try {
            const state = await readBudgetHoldState(paths.state);
            const config = monitorConfig.get() ?? ctx.config ?? api.config;
            await persistDeliveryReceipts(state, config);
            const recipients = listRunnableTlonAccountIds(config).map((id) => ({
              id,
              key: recipientKey(id, config),
            }));
            const pendingRecipients = recipients.filter(
              ({ key }) => !state.notifiedRecipients?.includes(key)
            );
            // Completion is relative to the current recipients, not permanent
            // for the episode. Existing delivery receipts still deduplicate.
            if (state.notified && pendingRecipients.length > 0) {
              state.notified = false;
              await writeBudgetHoldState(paths.state, state);
            }
            const canNotify =
              !notificationFlight &&
              recipients.length > 0 &&
              (pendingRecipients.length === 0 ||
                pendingRecipients.some(
                  ({ id, key }) => notifiers.get(id)?.key === key
                ));
            const budget = await readBudgetSignal(paths.signal);
            try {
              await reconcileBudgetHolds({
                budget,
                state,
                cron: {
                  list: (options) => cron.list(options),
                  update: async (id, patch) => {
                    const generation = pendingEdits.get(id);
                    const scope = { active: true };
                    let result: unknown;
                    try {
                      result = await ownMutation.run(scope, () =>
                        cron.update(id, patch)
                      );
                    } finally {
                      // Timers created by core inherit this async context, but
                      // later mutations are no longer part of our own write.
                      scope.active = false;
                    }
                    // A new hold incorporates edits already seen by this pass.
                    // Do not revoke it again on the queued follow-up pass, but
                    // retain any newer edit received while this write awaited.
                    if (
                      patch.enabled === false &&
                      pendingEdits.get(id) === generation
                    ) {
                      pendingEdits.delete(id);
                      edits.delete(id);
                    }
                    return result;
                  },
                },
                externallyEditedJobs: edits,
                save: () => writeBudgetHoldState(paths.state, state),
                notify: canNotify
                  ? async (message) => {
                      if (pendingRecipients.length === 0) return true;
                      const episodeId = state.episodeId;
                      if (!episodeId) return false;
                      const blob = buildCreditIncreaseCard(message, episodeId);
                      // Reconciliation already persisted the retry backoff.
                      // Delivery runs separately; only its receipt is merged
                      // on a later pass, without blocking scheduler updates.
                      notificationFlight = (async () => {
                        for (const { id, key } of pendingRecipients) {
                          const notifier = notifiers.get(id);
                          if (notifier?.key !== key) continue;
                          try {
                            if (await notifier.send(message, blob)) {
                              deliveryReceipts.push({ episodeId, key });
                            }
                          } catch (error) {
                            api.logger.warn(
                              `[tlon] Cron budget notice failed: ${String(error)}`
                            );
                          }
                        }
                      })().finally(() => {
                        notificationFlight = undefined;
                        void tick();
                      });
                      return false;
                    }
                  : undefined,
              });
            } finally {
              // Even if a later update or notification fails, report changes
              // already confirmed in this pass. Analytics cannot gate recovery.
              try {
                if (
                  observer.observe(config, budget, state) &&
                  state.pendingTelemetryChanges?.length
                ) {
                  delete state.pendingTelemetryChanges;
                  await writeBudgetHoldState(paths.state, state);
                }
              } catch (error) {
                api.logger.warn(
                  `[tlon] Cron budget telemetry failed: ${String(error)}`
                );
              }
            }
          } catch (error) {
            for (const id of edits) {
              if (!pendingEdits.has(id)) pendingEdits.set(id, ++editGeneration);
            }
            throw error;
          } finally {
            activeEdits = undefined;
          }
        } while (rerun && !stopped);
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
      getCron: () => ctx.getCron?.() ?? getTlonCronService(),
      tick,
      changed: (event) => {
        if (event.action === 'updated') {
          if (ownMutation.getStore()?.active) return;
          // Record before any await: a finishing run can overwrite updatedAtMs
          // before reconciliation sees the manually edited job.
          pendingEdits.set(event.jobId, ++editGeneration);
          activeEdits?.add(event.jobId);
        }
        if (
          event.action === 'added' ||
          event.action === 'updated' ||
          event.action === 'removed'
        ) {
          void tick();
        }
      },
      stop: async () => {
        stopped = true;
        clearInterval(timer);
        await flight;
        await notificationFlight;
        if (deliveryReceipts.length) {
          await persistDeliveryReceipts(
            await readBudgetHoldState(paths.state),
            monitorConfig.get() ?? ctx.config ?? api.config
          );
        }
        await observer.close();
      },
    });
    return tick();
  });
  // Do not await inside a cron mutation's hook. Reconciliation itself mutates
  // cron jobs; awaiting here could deadlock the host's mutation lock.
  api.on('cron_changed', (event) => {
    runnerSlot.get()?.changed(event);
  });
  api.on('gateway_stop', async () => {
    const runner = runnerSlot.get();
    await runner?.stop();
    if (runnerSlot.get() === runner) {
      runnerSlot.set(null);
      monitorConfig.set(null);
    }
  });
}
