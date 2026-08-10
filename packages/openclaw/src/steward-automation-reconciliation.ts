import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import type {
  PluginHookGatewayContext,
  PluginHookGatewayCronService,
} from 'openclaw/plugin-sdk/types';

import { submitStewardAutomationProject } from './steward-automation-adapter.js';
import { normalizeStewardAutomationProject } from './steward-automation-projection.js';

type StewardAutomationCronService = Pick<PluginHookGatewayCronService, 'list'>;

export type StewardAutomationCronAccessor =
  | (() => StewardAutomationCronService | undefined)
  | undefined;

interface ReconciliationWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface PendingReconciliation {
  getCron: StewardAutomationCronAccessor;
  waiters: ReconciliationWaiter[];
}

export class StewardAutomationCronUnavailableError extends Error {
  readonly retryable = true;

  constructor(reason: 'missing-accessor' | 'missing-service') {
    const detail =
      reason === 'missing-accessor'
        ? 'the gateway hook context did not provide getCron'
        : 'getCron did not provide a cron service';
    super(
      `Steward automation reconciliation is temporarily unavailable: ${detail}`
    );
    this.name = 'StewardAutomationCronUnavailableError';
  }
}

/** Read and submit one complete snapshot from the pinned gateway cron API. */
export async function reconcileStewardAutomation(
  getCron: StewardAutomationCronAccessor
): Promise<void> {
  if (!getCron) {
    throw new StewardAutomationCronUnavailableError('missing-accessor');
  }

  const cron = getCron();
  if (!cron) {
    throw new StewardAutomationCronUnavailableError('missing-service');
  }

  const jobs = await cron.list({ includeDisabled: true });
  const action = normalizeStewardAutomationProject(jobs);
  await submitStewardAutomationProject(action);
}

/**
 * Serializes complete reconciliations and collapses a busy-period burst into
 * one follow-up using the latest trigger's cron accessor.
 *
 * Each trigger promise belongs to the batch that covers that trigger. A batch
 * failure rejects only that batch's promises; an already-pending follow-up is
 * still drained and settles independently. This keeps failures visible without
 * losing newer repair triggers and leaves retry policy to task 3.5.
 */
export class StewardAutomationReconciler {
  private pending: PendingReconciliation | null = null;
  private running = false;

  constructor(
    private readonly reconcile: (
      getCron: StewardAutomationCronAccessor
    ) => Promise<void> = reconcileStewardAutomation
  ) {}

  trigger(getCron: StewardAutomationCronAccessor): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      if (this.pending) {
        this.pending.getCron = getCron;
        this.pending.waiters.push(waiter);
      } else {
        this.pending = { getCron, waiters: [waiter] };
      }
    });

    if (!this.running) {
      this.running = true;
      void this.drain();
    }

    return promise;
  }

  private async drain(): Promise<void> {
    while (this.pending) {
      const batch = this.pending;
      this.pending = null;

      try {
        await this.reconcile(batch.getCron);
        for (const waiter of batch.waiters) {
          waiter.resolve();
        }
      } catch (error) {
        for (const waiter of batch.waiters) {
          waiter.reject(error);
        }
      }
    }

    // The loop condition and this assignment execute without an await between
    // them. A later trigger therefore either becomes pending before the loop
    // drains or observes running=false and starts a new worker.
    this.running = false;
  }
}

/**
 * Register complete-snapshot triggers. Errors deliberately reject the hook
 * promise so task 3.5 can retry them; the eventual index wrapper owns logging
 * and isolation from other hook consumers.
 */
export function registerStewardAutomationReconciliationHooks(
  api: Pick<OpenClawPluginApi, 'on'>
): void {
  const reconciler = new StewardAutomationReconciler();
  const trigger = (ctx: Pick<PluginHookGatewayContext, 'getCron'>) =>
    reconciler.trigger(ctx.getCron);

  api.on('gateway_start', (_event, ctx) => trigger(ctx));
  api.on('cron_changed', (_event, ctx) => trigger(ctx));
}
