import {
  configureGatewayStatus,
  gatewayHeartbeat,
  gatewayStart,
  gatewayStop,
} from '@tloncorp/api';
import { randomUUID } from 'node:crypto';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';

import { sharedSlot } from './shared-state.js';
import { listTlonAccountIds } from './types.js';
import { configureTlonApiWithPoke } from './urbit/api-client.js';

// Shared-state slot for the @tloncorp/api client params. The monitor
// publishes its SSE-bound poke + ship coords here; every other module
// context (notably this one) reads them and configures its OWN local
// @tloncorp/api singleton before any poke call. Storing a callback would
// configure the publisher's @tloncorp/api instance, not the reader's, so
// we deliberately move *data* through the slot, not behavior.
export const API_CLIENT_PARAMS_SLOT = '@tloncorp/openclaw.api-client-params';

export interface SharedApiClientParams {
  poke: (params: {
    app: string;
    mark: string;
    json: unknown;
  }) => Promise<unknown>;
  shipName: string;
  shipUrl: string;
}

const apiClientParamsSlot = sharedSlot<SharedApiClientParams>(
  API_CLIENT_PARAMS_SLOT
);

// ── Constants (matching design doc recommendations) ─────────
export const HEARTBEAT_INTERVAL_MS = 30_000; // 30s
const LEASE_DURATION_MS = 90_000; // 90s
export const ACTIVE_WINDOW_SECS = 300; // 5 min
export const OFFLINE_REPLY_COOLDOWN_SECS = 300; // 5 min

// A poke that hangs (observed racing an SSE reconnect) must not be allowed
// to wedge activation forever; bound it and retry instead.
export const GATEWAY_STATUS_ACTIVATION_TIMEOUT_MS = 15_000;
export const GATEWAY_STATUS_ACTIVATION_RETRY_MS = 30_000;

// Log/telemetry-only: SSE only goes live at api.connect(), well after this
// activation task launches, so a timer firing here can never tell us
// anything is actually wrong — it can only tell us to go look. It NEVER
// triggers activation itself.
export const GATEWAY_STATUS_START_WATCHDOG_MS = 60_000;

export function computeLeaseUntil(): number {
  return Date.now() + LEASE_DURATION_MS;
}

/** True iff exactly one Tlon account is configured. v1 requires exactly one
 * because the global @tloncorp/api client can't target multiple ships;
 * with >1 account, every eligible monitor would race the same client. */
export function isGatewayStatusEligible(cfg: OpenClawConfig): boolean {
  return listTlonAccountIds(cfg).length === 1;
}

// ── Generation-aware coordinator ─────────────────────────────
//
// Models one "lifecycle" per gateway boot: a `gateway_start` hook call
// begins a generation, a `gateway_stop` hook call latches it stopped. The
// coordinator itself is process-lifetime and created exactly once (see
// gateway-status-registration.ts) — but unlike the old one-shot manager it
// survives BOTH an in-process stop→start restart (SIGUSR1, no fresh
// `globalThis`) AND a repeated `registerFull` pass (OpenClaw
// 6.11+'s post-startup runtime-plugin prewarm), because generations reset
// its internal latches instead of the whole object being replaced.
export interface GatewayLifecycle {
  readonly generation: number;
  readonly bootId: string;
}

export interface GatewayStatusCoordinatorLogger {
  log?: (msg: string) => void;
  error?: (msg: string) => void;
}

export interface GatewayStatusCoordinator {
  /** Generation of the current (possibly stopped) lifecycle. 0 = no lifecycle has ever started. */
  readonly currentGeneration: number;
  /** bootId of the current lifecycle. Empty string before the first generation. */
  readonly bootId: string;
  /** True once `markStopped` has latched the CURRENT generation stopped. */
  readonly stopped: boolean;

  /**
   * Idle/stopped → started transition ONLY. From idle (generation 0) or a
   * stopped generation, bumps the generation, mints a fresh bootId, and
   * resets the starting/activated/stopped latches. Called while the current
   * generation is already started (not stopped) it is a no-op that returns
   * the CURRENT generation unchanged — so re-binding this hook on every
   * `registerFull` pass, or a duplicate `gateway_start` emit, never mints an
   * extra generation.
   */
  beginGeneration(): GatewayLifecycle;

  /**
   * Atomic wait — no capture-then-wait race. Resolves immediately iff the
   * current lifecycle is started AND not stopped; otherwise resolves with
   * the NEXT lifecycle produced by `beginGeneration()`. This is what makes
   * "monitor starts before gateway_start fires" (the common in-process
   * restart ordering) and "monitor starts after stop(N), before start(N+1)"
   * both resolve on the correct (next) generation instead of a stale one.
   */
  waitForStartedLifecycle(signal?: AbortSignal): Promise<GatewayLifecycle>;

  /** Mark that a %gateway-start poke is in flight for `generation`. No-op if `generation` is stale. */
  markStarting(generation: number): void;

  /** Mark `generation` fully activated (the %gateway-start poke succeeded). No-op if `generation` is stale. */
  markActivated(generation: number): void;

  /**
   * Latch `generation` stopped and, if a start was in flight or done for
   * it, send the matching %gateway-stop poke. No-op (including no poke) if
   * `generation` is stale or already stopped. Latching happens
   * synchronously before the poke so a concurrent activation's
   * post-poke recheck can observe `stopped` immediately.
   */
  markStopped(generation: number, reason?: string): Promise<void>;
}

export function createGatewayStatusCoordinator(opts?: {
  logger?: GatewayStatusCoordinatorLogger;
}): GatewayStatusCoordinator {
  let generation = 0;
  let bootId = '';
  let starting = false;
  let activated = false;
  let stopped = false;
  type Waiter = (lc: GatewayLifecycle) => void;
  let waiters: Waiter[] = [];

  const isStarted = () => generation > 0 && !stopped;

  const flushWaiters = (lc: GatewayLifecycle): void => {
    const toResolve = waiters;
    waiters = [];
    for (const resolve of toResolve) {
      resolve(lc);
    }
  };

  const beginGeneration = (): GatewayLifecycle => {
    if (isStarted()) {
      return { generation, bootId };
    }
    generation += 1;
    bootId = randomUUID();
    starting = false;
    activated = false;
    stopped = false;
    const lc: GatewayLifecycle = { generation, bootId };
    flushWaiters(lc);
    return lc;
  };

  const waitForStartedLifecycle = (
    signal?: AbortSignal
  ): Promise<GatewayLifecycle> => {
    if (isStarted()) {
      return Promise.resolve({ generation, bootId });
    }
    if (signal?.aborted) {
      return Promise.reject(
        new Error('Aborted while waiting for gateway lifecycle start')
      );
    }
    return new Promise<GatewayLifecycle>((resolve, reject) => {
      const onResolve: Waiter = (lc) => {
        signal?.removeEventListener('abort', onAbort);
        resolve(lc);
      };
      const onAbort = () => {
        waiters = waiters.filter((w) => w !== onResolve);
        reject(new Error('Aborted while waiting for gateway lifecycle start'));
      };
      waiters.push(onResolve);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  };

  const markStarting = (gen: number): void => {
    if (gen !== generation) {
      return;
    }
    starting = true;
  };

  const markActivated = (gen: number): void => {
    if (gen !== generation) {
      return;
    }
    activated = true;
  };

  const markStopped = async (gen: number, reason?: string): Promise<void> => {
    if (gen !== generation || stopped) {
      return;
    }
    // Latch stopped FIRST, unconditionally, before the async %gateway-stop
    // poke below. An activation may be in flight (between the
    // %gateway-start poke and markActivated()); latching synchronously
    // makes its post-poke recheck bail so it can't start a heartbeat after
    // we've already decided this generation is done.
    const startPokeInFlightOrDone = starting || activated;
    const stoppedBootId = bootId;
    stopped = true;
    // Only send %gateway-stop if a %gateway-start has been or is being
    // sent. If activation never reached the start poke, there is nothing
    // for the ship to stop.
    if (!startPokeInFlightOrDone) {
      return;
    }
    try {
      const sent = await sendGatewayStop({
        bootId: stoppedBootId,
        reason: reason ?? 'shutdown',
      });
      if (sent) {
        opts?.logger?.log?.(
          `[gateway-status] stopped (reason=${reason ?? 'shutdown'})`
        );
      } else {
        opts?.logger?.error?.(
          '[gateway-status] stop skipped: api-client params not published'
        );
      }
    } catch (err) {
      opts?.logger?.error?.(
        `[gateway-status] stop poke failed: ${String(err)}`
      );
    }
  };

  return {
    get currentGeneration() {
      return generation;
    },
    get bootId() {
      return bootId;
    },
    get stopped() {
      return stopped;
    },
    beginGeneration,
    waitForStartedLifecycle,
    markStarting,
    markActivated,
    markStopped,
  };
}

// Routed through shared-state so the slot survives plugin module isolation —
// the extension sets, the monitor reads, and they live in separate contexts.
const coordinatorSlot = sharedSlot<GatewayStatusCoordinator>(
  'gateway-status.coordinator'
);

export function setGatewayStatusCoordinator(
  c: GatewayStatusCoordinator | null
): void {
  coordinatorSlot.set(c);
}

export function getGatewayStatusCoordinator(): GatewayStatusCoordinator | null {
  return coordinatorSlot.get();
}

// Configure THIS module's @tloncorp/api singleton against the
// monitor-published params, then send the gateway-stop poke. Callers
// (notably GatewayStatusCoordinator.markStopped) must go through this
// helper instead of importing `gatewayStop` directly, because under
// OpenClaw >=2026.4.27 plugin module isolation the entry module's
// @tloncorp/api instance is never configured — only the monitor's is.
// Routing through gateway-status.ts reuses the same configured instance
// the heartbeat uses. Returns true if the poke was sent, false if the
// params slot was empty.
export async function sendGatewayStop(params: {
  bootId: string;
  reason: string;
}): Promise<boolean> {
  const apiParams = apiClientParamsSlot.get();
  if (!apiParams) {
    return false;
  }
  configureTlonApiWithPoke(
    apiParams.poke,
    apiParams.shipName,
    apiParams.shipUrl
  );
  await gatewayStop({ bootId: params.bootId, reason: params.reason });
  return true;
}

// ── Monitor-local heartbeat ──────────────────────────────────
//
// Fix C: the heartbeat interval lives with the CALLER (the monitor), not on
// the coordinator — each activation owns its own `setInterval`, so a stale
// monitor's cleanup can never kill a replacement monitor's heartbeat by
// construction (no shared interval, no ownership token needed). Each tick
// still self-checks `isValid()` and clears itself, as a safety net on top
// of the caller's own direct `stop()` on cleanup.
export interface StartGatewayHeartbeatLoopOptions {
  bootId: string;
  /** Re-checked every tick; when false the interval clears itself. */
  isValid: () => boolean;
  logger?: GatewayStatusCoordinatorLogger;
  onError?: (err: unknown) => void;
  intervalMs?: number;
}

/** Starts a monitor-local heartbeat loop; returns a `stop()` the caller should invoke on teardown. */
export function startGatewayHeartbeatLoop(
  heartbeatOpts: StartGatewayHeartbeatLoopOptions
): () => void {
  const intervalMs = heartbeatOpts.intervalMs ?? HEARTBEAT_INTERVAL_MS;
  const interval = setInterval(async () => {
    if (!heartbeatOpts.isValid()) {
      clearInterval(interval);
      return;
    }
    try {
      // Configure THIS module's @tloncorp/api instance against the
      // monitor-published params every tick. Under OpenClaw plugin
      // module isolation this code path can hold a separate
      // @tloncorp/api instance from the monitor; outbound DMs via
      // `withAuthenticatedTlonApi` can also rotate the global client
      // between heartbeats. Reapplying here keeps the heartbeat poke
      // pointed at the SSE-bound client.
      const params = apiClientParamsSlot.get();
      if (!params) {
        heartbeatOpts.logger?.error?.(
          '[gateway-status] heartbeat skipped: api-client params not published'
        );
        return;
      }
      configureTlonApiWithPoke(params.poke, params.shipName, params.shipUrl);
      await gatewayHeartbeat({
        bootId: heartbeatOpts.bootId,
        leaseUntil: computeLeaseUntil(),
      });
    } catch (err) {
      heartbeatOpts.onError?.(err);
      heartbeatOpts.logger?.error?.(
        `[gateway-status] heartbeat failed: ${String(err)}`
      );
    }
  }, intervalMs);
  heartbeatOpts.logger?.log?.(
    `[gateway-status] heartbeat started (interval=${intervalMs}ms)`
  );
  return () => clearInterval(interval);
}

// ── Activation orchestration ─────────────────────────────────
//
// Extracted so it's independently unit-testable without pulling in the
// (very large) monitor module: wait for a started lifecycle, send
// %configure + %gateway-start for THAT lifecycle, then hand off to the
// monitor-local heartbeat. Re-checks the lifecycle-validity predicate
// (same generation, not stopped, not aborted, not torn down) after every
// await, and bails silently the instant it fails — this is the
// generation-aware form of the manager's old `stopped` rechecks.

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Bound an activation poke so a silently-hung promise surfaces as a
// retryable error instead of leaving gateway-status dead for the
// lifecycle's lifetime. The underlying poke may still settle after the
// timeout; the trailing no-op catch keeps a late rejection from becoming
// an unhandled rejection, and a late duplicate poke is harmless (same
// bootId/values).
function withActivationTimeout<T>(
  promise: Promise<T>,
  label: string,
  timeoutMs: number
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      promise.catch(() => {});
      reject(new Error(`${label} poke timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface RunGatewayStatusActivationOptions {
  coordinator: GatewayStatusCoordinator;
  owner: string;
  signal?: AbortSignal;
  /** True once the monitor's own teardown has run. */
  isTornDown: () => boolean;
  logger?: GatewayStatusCoordinatorLogger;
  onActivationError?: (err: unknown, attempt: number) => void;
  onHeartbeatError?: (err: unknown) => void;
  onWatchdogTimeout?: () => void;
  /** Invoked once with a stop() handle as soon as the heartbeat starts, so the caller can clear it directly on teardown. */
  registerHeartbeatStop: (stop: () => void) => void;
  activationTimeoutMs?: number;
  activationRetryMs?: number;
  watchdogMs?: number;
}

export async function runGatewayStatusActivation(
  activationOpts: RunGatewayStatusActivationOptions
): Promise<void> {
  const {
    coordinator,
    owner,
    signal,
    isTornDown,
    logger,
    onActivationError,
    onHeartbeatError,
    onWatchdogTimeout,
    registerHeartbeatStop,
  } = activationOpts;
  const activationTimeoutMs =
    activationOpts.activationTimeoutMs ?? GATEWAY_STATUS_ACTIVATION_TIMEOUT_MS;
  const activationRetryMs =
    activationOpts.activationRetryMs ?? GATEWAY_STATUS_ACTIVATION_RETRY_MS;
  const watchdogMs =
    activationOpts.watchdogMs ?? GATEWAY_STATUS_START_WATCHDOG_MS;

  let lc: GatewayLifecycle;
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  try {
    watchdogTimer = setTimeout(() => {
      logger?.error?.(
        `[gateway-status] waitForStartedLifecycle has not resolved after ${watchdogMs}ms — log/telemetry only, does not activate`
      );
      onWatchdogTimeout?.();
    }, watchdogMs);
    watchdogTimer.unref?.();
    lc = await coordinator.waitForStartedLifecycle(signal);
  } catch {
    // Aborted while waiting for a lifecycle to start (monitor torn down
    // before the gateway did). Nothing to activate.
    return;
  } finally {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
    }
  }

  const isValid = (): boolean =>
    coordinator.currentGeneration === lc.generation &&
    !coordinator.stopped &&
    !signal?.aborted &&
    !isTornDown();

  if (!isValid()) {
    return;
  }

  // One-shot activation proved fragile: a single silently-hung poke
  // (observed when activation raced an SSE reconnect) left gateway-status
  // dead for the whole lifecycle, so the ship marked the gateway %down and
  // auto-replied "bot is offline" to owner DMs. Retry with a per-attempt
  // timeout until activation sticks or this lifecycle is superseded/torn
  // down.
  for (let attempt = 1; ; attempt += 1) {
    if (!isValid()) {
      return;
    }
    try {
      await withActivationTimeout(
        configureGatewayStatus({
          owner,
          activeWindowSecs: ACTIVE_WINDOW_SECS,
          offlineReplyCooldownSecs: OFFLINE_REPLY_COOLDOWN_SECS,
        }),
        '%configure',
        activationTimeoutMs
      );
      if (!isValid()) {
        return;
      }
      // Mark starting before the %gateway-start poke so a concurrent
      // gateway_stop hook knows a start poke is in flight and sends a
      // matching %gateway-stop even if shutdown lands before markActivated().
      coordinator.markStarting(lc.generation);
      await withActivationTimeout(
        gatewayStart({ bootId: lc.bootId, leaseUntil: computeLeaseUntil() }),
        '%gateway-start',
        activationTimeoutMs
      );
      if (!isValid()) {
        return;
      }
      coordinator.markActivated(lc.generation);
      const stopHeartbeat = startGatewayHeartbeatLoop({
        bootId: lc.bootId,
        isValid,
        logger,
        onError: onHeartbeatError,
      });
      registerHeartbeatStop(stopHeartbeat);
      logger?.log?.(
        `[gateway-status] activated (bootId=${lc.bootId}, owner=${owner}, generation=${lc.generation}, attempt=${attempt})`
      );
      return;
    } catch (err) {
      onActivationError?.(err, attempt);
      logger?.error?.(
        `[gateway-status] activation attempt ${attempt} failed: ${String(err)} — retrying in ${activationRetryMs / 1000}s`
      );
    }
    await abortableDelay(activationRetryMs, signal);
  }
}

// ── Per-monitor activation gate (Fix B) ──────────────────────
//
// The single production decision point for whether THIS monitor should
// drive gateway-status for its boot. Derives eligibility from the monitor's
// own config snapshot (`cfg` = the channel-start `ctx.cfg`, threaded via
// MonitorTlonOpts), so an account added/removed through a `channels.tlon`
// hot-reload — which restarts monitors WITHOUT re-running `registerFull` —
// re-evaluates the gate on the fresh snapshot. Kept as one exported
// function so tests exercise the exact gate the monitor runs (not a re-typed
// copy that could drift from, or silently revert past, the production path).
export interface GateGatewayStatusActivationOptions {
  cfg: OpenClawConfig;
  coordinator: GatewayStatusCoordinator | null;
  effectiveOwnerShip: string | null;
  signal?: AbortSignal;
  isTornDown: () => boolean;
  logger?: GatewayStatusCoordinatorLogger;
  onActivationError?: (err: unknown, attempt: number) => void;
  onHeartbeatError?: (err: unknown) => void;
  onWatchdogTimeout?: () => void;
  /** Called (with the account count) when activation is skipped because >1 Tlon account is configured. */
  onMultiAccountSkip?: (accountCount: number) => void;
  registerHeartbeatStop: (stop: () => void) => void;
  activationTimeoutMs?: number;
  activationRetryMs?: number;
  watchdogMs?: number;
}

/**
 * Decide-and-launch. Returns the in-flight activation promise when this
 * monitor is eligible (coordinator present, owner known, exactly one Tlon
 * account), else `null`. The monitor fire-and-forgets it; tests await it.
 */
export function gateGatewayStatusActivation(
  gateOpts: GateGatewayStatusActivationOptions
): Promise<void> | null {
  const { cfg, coordinator, effectiveOwnerShip } = gateOpts;
  if (!coordinator || !effectiveOwnerShip) {
    return null;
  }
  if (isGatewayStatusEligible(cfg)) {
    return runGatewayStatusActivation({
      coordinator,
      owner: effectiveOwnerShip,
      signal: gateOpts.signal,
      isTornDown: gateOpts.isTornDown,
      logger: gateOpts.logger,
      onActivationError: gateOpts.onActivationError,
      onHeartbeatError: gateOpts.onHeartbeatError,
      onWatchdogTimeout: gateOpts.onWatchdogTimeout,
      registerHeartbeatStop: gateOpts.registerHeartbeatStop,
      activationTimeoutMs: gateOpts.activationTimeoutMs,
      activationRetryMs: gateOpts.activationRetryMs,
      watchdogMs: gateOpts.watchdogMs,
    });
  }
  const accountCount = listTlonAccountIds(cfg).length;
  if (accountCount > 1) {
    gateOpts.onMultiAccountSkip?.(accountCount);
  }
  return null;
}
