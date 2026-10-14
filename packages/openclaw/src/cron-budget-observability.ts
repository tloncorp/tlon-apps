import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

import type { BudgetHoldState, BudgetState } from './cron-budget-hold.js';
import { createTlonTelemetry, type TlonTelemetryClient } from './telemetry.js';
import { normalizeShip } from './targets.js';
import { listRunnableTlonAccountIds, resolveTlonAccount } from './types.js';

/** Gateway-owned: telemetry is available even before account monitors connect.
 * Delivery is best effort like the existing cron events; it cannot block holds.
 * The ledger carries startup transitions across the preflight process boundary.
 */
export function createBudgetHoldObserver(
  logger: Pick<OpenClawPluginApi['logger'], 'info' | 'warn'>
) {
  const clients = new Map<
    string,
    { settings: string; client: TlonTelemetryClient | null }
  >();
  const snapshots = new Map<string, string>();
  const safely = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      logger.warn(`[tlon] Cron budget telemetry failed: ${String(error)}`);
    }
  };
  return {
    observe(
      config: OpenClawPluginApi['config'],
      budgetState: BudgetState,
      state: BudgetHoldState
    ) {
      // Unconfirmed write-ahead intents are not counted as successful pauses.
      const budgetPausedCronCount = Object.values(state.holds).filter(
        (hold) => hold.revision !== undefined
      ).length;
      const accountIds = listRunnableTlonAccountIds(config);
      for (const accountId of accountIds) {
        const account = resolveTlonAccount(config, accountId);
        const identity = {
          accountId,
          botShip: normalizeShip(account.ship!),
          ownerShip: account.ownerShip
            ? normalizeShip(account.ownerShip)
            : null,
        };
        const identityKey = JSON.stringify(identity);
        const fields = {
          ...identity,
          budgetState,
          episodeId: state.episodeId ?? null,
          budgetPausedCronCount,
        };
        const signature = JSON.stringify(fields);
        const previous = snapshots.get(identityKey);
        const snapshot = {
          ...fields,
          reason:
            previous === undefined
              ? ('gateway_start' as const)
              : ('state_change' as const),
        };
        // Keep structured pod logs available even when product telemetry is off.
        if (signature !== previous)
          safely(() =>
            logger.info(
              JSON.stringify({
                event: 'TlonBot Cron Budget Snapshot',
                ...snapshot,
              })
            )
          );
        for (const change of state.pendingTelemetryChanges ?? [])
          safely(() =>
            logger.info(
              JSON.stringify({
                event: 'TlonBot Cron Budget Changed',
                ...identity,
                ...change,
              })
            )
          );
        safely(() => {
          const settings = JSON.stringify(account.telemetry);
          let entry = clients.get(accountId);
          if (!entry || entry.settings !== settings) {
            void entry?.client?.close().catch((error) => {
              logger.warn(
                `[tlon] Cron budget telemetry close failed: ${String(error)}`
              );
            });
            entry = {
              settings,
              client: createTlonTelemetry({ config: account.telemetry }),
            };
            clients.set(accountId, entry);
          }
          for (const change of state.pendingTelemetryChanges ?? []) {
            entry.client?.captureCronBudgetChanged({ ...identity, ...change });
          }
          if (signature !== previous)
            entry.client?.captureCronBudgetSnapshot(snapshot);
        });
        snapshots.set(identityKey, signature);
      }
      // An empty config must not consume a startup journal before its accounts
      // are available. Disabled product telemetry still has the pod log copy.
      return accountIds.length > 0;
    },
    async close() {
      await Promise.allSettled(
        [...clients.values()].map(({ client }) => client?.close())
      );
      clients.clear();
      snapshots.clear();
    },
  };
}
