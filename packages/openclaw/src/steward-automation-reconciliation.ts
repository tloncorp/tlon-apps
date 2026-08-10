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

export const DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS = 5_000;

export type StewardAutomationRetryDelay = (
  delayMs: number,
  signal?: AbortSignal
) => Promise<void>;

const waitForRetryDelay: StewardAutomationRetryDelay = (delayMs, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timeout = setTimeout(onElapsed, delayMs);
    function onElapsed() {
      signal?.removeEventListener('abort', onAborted);
      resolve();
    }
    function onAborted() {
      clearTimeout(timeout);
      reject(signal?.reason);
    }
    signal?.addEventListener('abort', onAborted, { once: true });
  });

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
 * Failed attempts wait once before retrying the complete read, normalization,
 * and submission. Triggers received during that delay do not wake it early;
 * they join the failed batch, and the next attempt uses the latest accessor.
 * Every joined trigger remains pending until that covering snapshot succeeds.
 */
export class StewardAutomationReconciler {
  private pending: PendingReconciliation | null = null;
  private running = false;

  constructor(
    private readonly reconcile: (
      getCron: StewardAutomationCronAccessor
    ) => Promise<void> = reconcileStewardAutomation,
    private readonly retryDelay: StewardAutomationRetryDelay = waitForRetryDelay,
    private readonly retryDelayMs = DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS,
    private readonly retrySignal?: AbortSignal
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
    for (;;) {
      const batch = this.takePending();
      if (!batch) {
        break;
      }

      for (;;) {
        try {
          await this.reconcile(batch.getCron);
          for (const waiter of batch.waiters) {
            waiter.resolve();
          }
          break;
        } catch {
          try {
            await this.retryDelay(this.retryDelayMs, this.retrySignal);
          } catch (delayError) {
            this.rejectBatch(batch, delayError);
            const pending = this.takePending();
            if (pending) {
              this.rejectBatch(pending, delayError);
            }
            break;
          }

          // Wait for the single scheduled delay even if more triggers arrive.
          // They then join this retry, so no stale intermediate accessor is
          // read and all covered promises settle with the successful retry.
          const pending = this.takePending();
          if (pending) {
            batch.getCron = pending.getCron;
            batch.waiters.push(...pending.waiters);
          }
        }
      }
    }

    // The loop condition and this assignment execute without an await between
    // them. A later trigger therefore either becomes pending before the loop
    // drains or observes running=false and starts a new worker.
    this.running = false;
  }

  private takePending(): PendingReconciliation | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }

  private rejectBatch(batch: PendingReconciliation, error: unknown): void {
    for (const waiter of batch.waiters) {
      waiter.reject(error);
    }
  }
}

/**
 * Register complete-snapshot triggers. Each hook promise remains pending
 * across retryable reconciliation failures and resolves after delivery; the
 * eventual index wrapper owns logging and isolation from other hook consumers.
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
