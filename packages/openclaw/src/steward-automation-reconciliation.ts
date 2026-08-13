import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';
import type { PluginHookGatewayCronService } from 'openclaw/plugin-sdk/types';

import { sharedSlot } from './shared-state.js';
import { submitStewardAutomationProjection } from './steward-automation-adapter.js';
import { normalizeStewardAutomationProjection } from './steward-automation-projection.js';

type StewardAutomationCronService = Pick<PluginHookGatewayCronService, 'list'>;

export type StewardAutomationCronAccessor =
  | (() => StewardAutomationCronService | undefined)
  | undefined;

type StewardAutomationSubmissionGuard = () => void | Promise<void>;

type StewardAutomationReconciliation = (
  getCron: StewardAutomationCronAccessor,
  beforeSubmit?: StewardAutomationSubmissionGuard,
  assertCanSubmit?: () => void
) => Promise<void>;

interface ReconciliationWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface PendingReconciliation {
  epoch: number;
  getCron: StewardAutomationCronAccessor;
  waiters: ReconciliationWaiter[];
  settled: boolean;
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

export class StewardAutomationReconciliationCancelledError extends Error {
  readonly retryable = false;

  constructor(
    readonly epoch: number,
    readonly reason: 'gateway-stop' | 'gateway-restart'
  ) {
    super(
      `Steward automation reconciliation for gateway epoch ${epoch} was ` +
        `cancelled by ${reason}`
    );
    this.name = 'StewardAutomationReconciliationCancelledError';
  }
}

/** Read and submit one complete snapshot from the pinned gateway cron API. */
export async function reconcileStewardAutomation(
  getCron: StewardAutomationCronAccessor,
  beforeSubmit?: StewardAutomationSubmissionGuard,
  assertCanSubmit?: () => void
): Promise<void> {
  if (!getCron) {
    throw new StewardAutomationCronUnavailableError('missing-accessor');
  }

  const cron = getCron();
  if (!cron) {
    throw new StewardAutomationCronUnavailableError('missing-service');
  }

  const jobs = await cron.list({ includeDisabled: true });
  const projection = normalizeStewardAutomationProjection(jobs);
  await beforeSubmit?.();
  // Keep this synchronous check adjacent to invoking the adapter. Awaiting a
  // lifecycle guard here would reopen a microtask-sized stale-submit race.
  assertCanSubmit?.();
  await submitStewardAutomationProjection(projection);
}

/**
 * Owns serialized reconciliation for reusable gateway lifecycle epochs.
 *
 * `start` creates an epoch and requests its full snapshot, while duplicate
 * starts during that epoch are ignored. Active triggers are coalesced. `stop`
 * cancels retry delay, rejects
 * outstanding promises with a typed cancellation, and leaves durable Steward
 * state untouched. A stopped reconciler ignores later change triggers until a
 * new `start` creates a fresh epoch.
 */
export class StewardAutomationReconciler {
  private pending: PendingReconciliation | null = null;
  private current: PendingReconciliation | null = null;
  private running = false;
  private epoch = 0;
  private activeEpoch: number | null = null;
  private retryController: AbortController | null = null;

  constructor(
    private readonly reconcile: StewardAutomationReconciliation = reconcileStewardAutomation,
    private readonly retryDelay: StewardAutomationRetryDelay = waitForRetryDelay,
    private readonly retryDelayMs = DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS
  ) {}

  start(getCron: StewardAutomationCronAccessor): Promise<void> {
    // registerFull can bind this process-lifetime reconciler into several hook
    // registries. A duplicate gateway_start from another registry belongs to
    // the already-active gateway lifecycle and must not restart its worker.
    if (this.activeEpoch !== null) {
      return Promise.resolve();
    }

    const epoch = ++this.epoch;
    this.activeEpoch = epoch;
    this.retryController = new AbortController();
    return this.enqueue(epoch, getCron);
  }

  /** Ignore cron changes safely while no gateway epoch is active. */
  trigger(getCron: StewardAutomationCronAccessor): Promise<void> {
    if (this.activeEpoch === null) {
      return Promise.resolve();
    }
    return this.enqueue(this.activeEpoch, getCron);
  }

  stop(): void {
    this.deactivate();
  }

  private enqueue(
    epoch: number,
    getCron: StewardAutomationCronAccessor
  ): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };
      if (this.pending?.epoch === epoch) {
        this.pending.getCron = getCron;
        this.pending.waiters.push(waiter);
      } else {
        this.pending = {
          epoch,
          getCron,
          waiters: [waiter],
          settled: false,
        };
      }
    });

    if (!this.running) {
      this.running = true;
      void this.drain();
    }

    return promise;
  }

  private deactivate(): void {
    const epoch = this.activeEpoch;
    if (epoch === null) {
      return;
    }

    const cancellation = new StewardAutomationReconciliationCancelledError(
      epoch,
      'gateway-stop'
    );
    this.activeEpoch = null;
    this.retryController?.abort(cancellation);
    this.retryController = null;

    if (this.current?.epoch === epoch) {
      this.rejectBatch(this.current, cancellation);
    }
    if (this.pending?.epoch === epoch) {
      const pending = this.takePending();
      if (pending) {
        this.rejectBatch(pending, cancellation);
      }
    }
  }

  private async drain(): Promise<void> {
    try {
      for (;;) {
        const batch = this.takePending();
        if (!batch) {
          break;
        }
        this.current = batch;

        for (;;) {
          if (!this.isActiveEpoch(batch.epoch)) {
            this.rejectBatch(batch, this.cancellationFor(batch.epoch));
            break;
          }

          try {
            await this.reconcile(batch.getCron, undefined, () =>
              this.assertActiveEpoch(batch.epoch)
            );
            this.assertActiveEpoch(batch.epoch);
            this.resolveBatch(batch);
            break;
          } catch (error) {
            if (!this.isActiveEpoch(batch.epoch)) {
              this.rejectBatch(batch, this.cancellationFor(batch.epoch));
              break;
            }

            try {
              await this.retryDelay(
                this.retryDelayMs,
                this.retryController?.signal
              );
            } catch (delayError) {
              this.rejectBatch(batch, delayError);
              break;
            }

            if (!this.isActiveEpoch(batch.epoch)) {
              this.rejectBatch(batch, this.cancellationFor(batch.epoch));
              break;
            }

            // Triggers received during the delay join this retry. A pending
            // batch from a newer restarted epoch remains separate.
            if (this.pending?.epoch === batch.epoch) {
              const pending = this.takePending();
              if (pending) {
                batch.getCron = pending.getCron;
                batch.waiters.push(...pending.waiters);
              }
            }
          }
        }

        if (this.current === batch) {
          this.current = null;
        }
      }
    } finally {
      this.current = null;
      // No await separates the empty-queue observation from this assignment,
      // so a later trigger either joined the loop or starts a fresh worker.
      this.running = false;
    }
  }

  private isActiveEpoch(epoch: number): boolean {
    return this.activeEpoch === epoch;
  }

  private assertActiveEpoch(epoch: number): void {
    if (!this.isActiveEpoch(epoch)) {
      throw this.cancellationFor(epoch);
    }
  }

  private cancellationFor(epoch: number) {
    return new StewardAutomationReconciliationCancelledError(
      epoch,
      this.activeEpoch === null ? 'gateway-stop' : 'gateway-restart'
    );
  }

  private takePending(): PendingReconciliation | null {
    const pending = this.pending;
    this.pending = null;
    return pending;
  }

  private resolveBatch(batch: PendingReconciliation): void {
    if (batch.settled) {
      return;
    }
    batch.settled = true;
    for (const waiter of batch.waiters) {
      waiter.resolve();
    }
  }

  private rejectBatch(batch: PendingReconciliation, error: unknown): void {
    if (batch.settled) {
      return;
    }
    batch.settled = true;
    for (const waiter of batch.waiters) {
      waiter.reject(error);
    }
  }
}

const reconcilerSlot = sharedSlot<StewardAutomationReconciler>(
  'stewardAutomation.reconciler'
);

export function getStewardAutomationReconciler(): StewardAutomationReconciler | null {
  return reconcilerSlot.get();
}

export function setStewardAutomationReconciler(
  reconciler: StewardAutomationReconciler | null
): void {
  reconcilerSlot.set(reconciler);
}

export interface RegisterStewardAutomationReconciliationHooksOptions {
  logger: { warn: (message: string) => void };
}

function isExpectedCancellation(error: unknown): boolean {
  if (error instanceof StewardAutomationReconciliationCancelledError) {
    return true;
  }
  // The shared reconciler can originate in another plugin module-loader
  // context, where instanceof observes a different copy of this class.
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as {
    name?: unknown;
    reason?: unknown;
    retryable?: unknown;
  };
  return (
    candidate.name === 'StewardAutomationReconciliationCancelledError' &&
    candidate.retryable === false &&
    (candidate.reason === 'gateway-stop' ||
      candidate.reason === 'gateway-restart')
  );
}

function observeProjectionWork(
  work: Promise<void>,
  logger: RegisterStewardAutomationReconciliationHooksOptions['logger']
): void {
  void work.catch((error) => {
    if (isExpectedCancellation(error)) {
      return;
    }
    try {
      logger.warn(
        `[tlon] Steward automation projection failed: ${String(error)}`
      );
    } catch {
      // A host logger failure must not turn this rejection observer into a new
      // unhandled rejection or interfere with another hook consumer.
    }
  });
}

/**
 * Bind the current registration pass to one process-lifetime reconciler.
 * Hook handlers deliberately return void so projection retries and terminal
 * failures cannot block or reject OpenClaw's independent hook consumers.
 */
export function registerStewardAutomationReconciliationHooks(
  api: Pick<OpenClawPluginApi, 'on'>,
  options: RegisterStewardAutomationReconciliationHooksOptions
): StewardAutomationReconciler {
  let reconciler = getStewardAutomationReconciler();
  if (!reconciler) {
    reconciler = new StewardAutomationReconciler();
    setStewardAutomationReconciler(reconciler);
  }

  api.on('gateway_start', (_event, ctx) => {
    observeProjectionWork(reconciler.start(ctx.getCron), options.logger);
  });
  api.on('cron_changed', (_event, ctx) => {
    observeProjectionWork(reconciler.trigger(ctx.getCron), options.logger);
  });
  api.on('gateway_stop', () => {
    reconciler.stop();
  });
  return reconciler;
}
