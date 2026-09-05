import type {
  OpenClawConfig,
  OpenClawPluginApi,
} from 'openclaw/plugin-sdk/core';
import type { PluginHookGatewayCronService } from 'openclaw/plugin-sdk/types';

import { sharedSlot } from './shared-state.js';
import { submitStewardAutomationProjection } from './steward-automation-adapter.js';
import {
  type StewardAutomationRejectedJob,
  normalizeStewardAutomationProjectionWithRejections,
} from './steward-automation-projection.js';
import { reportTelemetryError } from './telemetry.js';
import { listRunnableTlonAccountIds } from './types.js';

type StewardAutomationCronService = Pick<PluginHookGatewayCronService, 'list'>;

export type StewardAutomationCronAccessor =
  | (() => StewardAutomationCronService | undefined)
  | undefined;

type StewardAutomationSubmissionGuard = () => void | Promise<void>;

/** Receives the jobs a snapshot could not represent, once per reconciliation. */
export type StewardAutomationRejectionReporter = (
  rejected: readonly StewardAutomationRejectedJob[]
) => void;

type StewardAutomationReconciliation = (
  getCron: StewardAutomationCronAccessor,
  beforeSubmit?: StewardAutomationSubmissionGuard,
  assertCanSubmit?: () => void,
  signal?: AbortSignal,
  onRejected?: StewardAutomationRejectionReporter
) => Promise<void>;

interface ReconciliationWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface PendingReconciliation {
  epoch: number;
  controller: AbortController;
  getCron: StewardAutomationCronAccessor;
  waiters: ReconciliationWaiter[];
  settled: boolean;
}

export const DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS = 5_000;
export const DEFAULT_STEWARD_AUTOMATION_OPERATION_TIMEOUT_MS = 30_000;
/** Attempts per batch before it is abandoned; about a minute at the default delay. */
export const DEFAULT_STEWARD_AUTOMATION_MAX_ATTEMPTS = 12;

/**
 * A batch gave up after repeated retryable failures. The last error is kept
 * so the log says what kept failing. Later triggers start a fresh batch.
 */
export class StewardAutomationReconciliationExhaustedError extends Error {
  readonly retryable = false;

  constructor(
    readonly attempts: number,
    readonly cause: unknown
  ) {
    super(
      `Steward automation reconciliation abandoned after ${attempts} ` +
        `attempts; last error: ${String(cause)}`
    );
    this.name = 'StewardAutomationReconciliationExhaustedError';
  }
}

/**
 * Errors that mark themselves non-retryable stop a batch at once. Anything
 * else — a nack, a transport failure, an unknown throw — is retried up to
 * the attempt cap, since a transient cause is the common case.
 */
function isRetryableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return true;
  }
  return (error as { retryable?: unknown }).retryable !== false;
}

export class StewardAutomationReconciliationTimeoutError extends Error {
  readonly retryable = true;

  constructor(
    readonly phase: 'read' | 'submission',
    readonly timeoutMs: number
  ) {
    super(
      `Steward automation ${phase} timed out after ${timeoutMs}ms; ` +
        'the complete reconciliation will be retried'
    );
    this.name = 'StewardAutomationReconciliationTimeoutError';
  }
}

function withReconciliationDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  epochSignal: AbortSignal,
  timeoutMs: number,
  getPhase: () => 'read' | 'submission'
): Promise<T> {
  const controller = new AbortController();
  const abortFromEpoch = () => controller.abort(epochSignal.reason);

  if (epochSignal.aborted) {
    abortFromEpoch();
  } else {
    epochSignal.addEventListener('abort', abortFromEpoch, { once: true });
  }

  const timeout = setTimeout(() => {
    controller.abort(
      new StewardAutomationReconciliationTimeoutError(getPhase(), timeoutMs)
    );
  }, timeoutMs);
  timeout.unref?.();

  let work: Promise<T>;
  try {
    work = operation(controller.signal);
  } catch (error) {
    work = Promise.reject(error);
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      epochSignal.removeEventListener('abort', abortFromEpoch);
      controller.signal.removeEventListener('abort', onAbort);
    };
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = () =>
      settle(() =>
        reject(
          controller.signal.reason ??
            new Error('Steward automation reconciliation was aborted')
        )
      );

    if (controller.signal.aborted) {
      onAbort();
    } else {
      controller.signal.addEventListener('abort', onAbort, { once: true });
    }

    // Keep handlers attached after an abort or timeout so a late rejection
    // from a transport that cannot be cancelled is still observed.
    work.then(
      (value) => settle(() => resolve(value)),
      (error) => settle(() => reject(error))
    );
  });
}

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

/** Read and submit one complete snapshot from the gateway cron API. */
export async function reconcileStewardAutomation(
  getCron: StewardAutomationCronAccessor,
  beforeSubmit?: StewardAutomationSubmissionGuard,
  assertCanSubmit?: () => void,
  signal?: AbortSignal,
  onRejected?: StewardAutomationRejectionReporter
): Promise<void> {
  signal?.throwIfAborted();
  if (!getCron) {
    throw new StewardAutomationCronUnavailableError('missing-accessor');
  }

  const cron = getCron();
  if (!cron) {
    throw new StewardAutomationCronUnavailableError('missing-service');
  }

  const jobs = await cron.list({ includeDisabled: true });
  signal?.throwIfAborted();
  const { projection, rejected } =
    normalizeStewardAutomationProjectionWithRejections(jobs);
  if (rejected.length > 0) {
    onRejected?.(rejected);
  }
  await beforeSubmit?.();
  signal?.throwIfAborted();
  // Keep these synchronous checks adjacent to invoking the adapter. Awaiting
  // a lifecycle guard here would reopen a microtask-sized stale-submit race.
  assertCanSubmit?.();
  await submitStewardAutomationProjection(projection);
}

/**
 * Owns serialized reconciliation for reusable gateway lifecycle epochs.
 *
 * `start` creates an epoch and requests its full snapshot, while duplicate
 * starts during that epoch are ignored. Active triggers are coalesced. `stop`
 * cancels retry delays and abandons in-flight operation waits, rejects
 * outstanding promises with a typed cancellation, and leaves durable Steward
 * state untouched. Each read-and-submit attempt also has a deadline so a hung
 * dependency cannot own the process-lifetime worker forever. A stopped
 * reconciler ignores later change triggers until a new `start` creates a fresh
 * epoch.
 */
export class StewardAutomationReconciler {
  private pending: PendingReconciliation | null = null;
  private current: PendingReconciliation | null = null;
  private running = false;
  private epoch = 0;
  private activeEpoch: number | null = null;
  private activeController: AbortController | null = null;

  constructor(
    private readonly reconcile: StewardAutomationReconciliation = reconcileStewardAutomation,
    private readonly retryDelay: StewardAutomationRetryDelay = waitForRetryDelay,
    private readonly retryDelayMs = DEFAULT_STEWARD_AUTOMATION_RETRY_DELAY_MS,
    private readonly operationTimeoutMs = DEFAULT_STEWARD_AUTOMATION_OPERATION_TIMEOUT_MS,
    private readonly maxAttempts = DEFAULT_STEWARD_AUTOMATION_MAX_ATTEMPTS,
    private readonly onRejected?: StewardAutomationRejectionReporter
  ) {}

  start(getCron: StewardAutomationCronAccessor): Promise<void> {
    // registerFull can bind this process-lifetime reconciler into several hook
    // registries. A duplicate gateway_start from another registry belongs to
    // the already-active gateway lifecycle and must not restart its worker.
    if (this.activeEpoch !== null) {
      return Promise.resolve();
    }

    const epoch = ++this.epoch;
    const controller = new AbortController();
    this.activeEpoch = epoch;
    this.activeController = controller;
    return this.enqueue(epoch, controller, getCron);
  }

  /** Ignore cron changes safely while no gateway epoch is active. */
  trigger(getCron: StewardAutomationCronAccessor): Promise<void> {
    if (this.activeEpoch === null || this.activeController === null) {
      return Promise.resolve();
    }
    return this.enqueue(this.activeEpoch, this.activeController, getCron);
  }

  stop(): void {
    const epoch = this.activeEpoch;
    if (epoch === null) {
      return;
    }

    const cancellation = new StewardAutomationReconciliationCancelledError(
      epoch,
      'gateway-stop'
    );
    this.activeEpoch = null;
    this.activeController?.abort(cancellation);
    this.activeController = null;

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

  private enqueue(
    epoch: number,
    controller: AbortController,
    getCron: StewardAutomationCronAccessor
  ): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      const waiter = { resolve, reject };

      if (this.pending) {
        if (
          this.pending.epoch !== epoch ||
          this.pending.controller !== controller
        ) {
          reject(
            new Error(
              `Reconciler invariant violated: pending epoch ` +
                `${this.pending.epoch}, requested epoch ${epoch}`
            )
          );
          return;
        }
        this.pending.getCron = getCron;
        this.pending.waiters.push(waiter);
      } else {
        this.pending = {
          epoch,
          controller,
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

  private async drain(): Promise<void> {
    try {
      for (;;) {
        const batch = this.takePending();
        if (!batch) {
          break;
        }
        this.current = batch;
        let attempts = 0;

        for (;;) {
          if (!this.isActiveEpoch(batch.epoch)) {
            this.rejectBatch(batch, this.cancellationFor(batch.epoch));
            break;
          }

          try {
            let phase: 'read' | 'submission' = 'read';
            // The deadline bounds our wait; it cannot revoke a remote side
            // effect after the adapter has issued it. Keeping the late work
            // observed prevents unhandled rejections, while the next attempt
            // rereads the complete authoritative snapshot.
            await withReconciliationDeadline(
              (signal) =>
                this.reconcile(
                  batch.getCron,
                  () => {
                    phase = 'submission';
                  },
                  () => this.assertActiveEpoch(batch.epoch),
                  signal,
                  this.onRejected
                ),
              batch.controller.signal,
              this.operationTimeoutMs,
              () => phase
            );
            this.assertActiveEpoch(batch.epoch);
            this.resolveBatch(batch);
            break;
          } catch (error) {
            if (!this.isActiveEpoch(batch.epoch)) {
              this.rejectBatch(batch, this.cancellationFor(batch.epoch));
              break;
            }

            // A non-retryable error, or one that keeps recurring, ends this
            // batch rather than owning the worker forever. Triggers that
            // coalesced into it are rejected with it; the next trigger starts
            // a fresh batch and rereads the complete snapshot.
            attempts += 1;
            if (!isRetryableError(error)) {
              this.rejectBatch(batch, error);
              break;
            }
            if (attempts >= this.maxAttempts) {
              this.rejectBatch(
                batch,
                new StewardAutomationReconciliationExhaustedError(
                  attempts,
                  error
                )
              );
              break;
            }

            try {
              await this.retryDelay(this.retryDelayMs, batch.controller.signal);
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

export function isStewardAutomationProjectionEligible(
  cfg: OpenClawConfig
): boolean {
  return listRunnableTlonAccountIds(cfg).length === 1;
}

export interface RegisterStewardAutomationReconciliationHooksOptions {
  logger: { warn: (message: string) => void };
  getConfig: () => OpenClawConfig;
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

/**
 * Jobs a snapshot could not represent are logged once each and reported to
 * telemetry so a stale-mirror question has an answer in PostHog. Reporting
 * must never disturb the projection itself.
 */
export function reportRejectedJobs(
  rejected: readonly StewardAutomationRejectedJob[],
  warn: (message: string) => void
): void {
  for (const job of rejected) {
    const label = job.id ?? '<no id>';
    warn(
      `[tlon] Steward automation projection dropped cron job ${label}: ${job.reason}`
    );
    try {
      reportTelemetryError({
        telemetrySource: 'steward_automation_projection',
        sourceEventName: job.kind,
        errorKind: job.kind,
        errorText: job.reason,
      });
    } catch {
      // Telemetry failures never affect the projection.
    }
  }
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
  let reportedIneligibleAccountCount: number | null = null;
  const warnSafely = (message: string): void => {
    try {
      options.logger.warn(message);
    } catch {
      // A host logger failure must not bypass the account-safety guard.
    }
  };

  let reconciler = getStewardAutomationReconciler();
  if (!reconciler) {
    reconciler = new StewardAutomationReconciler(
      reconcileStewardAutomation,
      undefined,
      undefined,
      undefined,
      undefined,
      (rejected) => reportRejectedJobs(rejected, warnSafely)
    );
    setStewardAutomationReconciler(reconciler);
  }
  const guardSingleAccount = (): boolean => {
    let config: OpenClawConfig;
    try {
      config = options.getConfig();
    } catch (error) {
      reconciler.stop();
      warnSafely(
        `[tlon] Steward automation projection disabled: current Tlon ` +
          `account configuration is unavailable: ${String(error)}`
      );
      return false;
    }
    if (isStewardAutomationProjectionEligible(config)) {
      reportedIneligibleAccountCount = null;
      return true;
    }
    const accountCount = listRunnableTlonAccountIds(config).length;

    // The connection slot is process-global, so no ship can be selected
    // safely when several account monitors can publish into it. Fail closed
    // and stop any epoch that began under an earlier one-account config.
    reconciler.stop();
    if (accountCount > 1 && reportedIneligibleAccountCount !== accountCount) {
      reportedIneligibleAccountCount = accountCount;
      warnSafely(
        `[tlon] Steward automation projection disabled: ${accountCount} ` +
          'runnable Tlon accounts are configured; v1 requires exactly one'
      );
    }
    return false;
  };

  api.on('gateway_start', (_event, ctx) => {
    if (guardSingleAccount()) {
      observeProjectionWork(reconciler.start(ctx.getCron), options.logger);
    }
  });
  api.on('cron_changed', (_event, ctx) => {
    if (guardSingleAccount()) {
      observeProjectionWork(reconciler.trigger(ctx.getCron), options.logger);
    }
  });
  api.on('gateway_stop', () => {
    reconciler.stop();
  });
  return reconciler;
}
