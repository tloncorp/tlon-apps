import {
  configureGatewayStatus,
  gatewayHeartbeat,
  gatewayStart,
  gatewayStop,
} from '@tloncorp/api';
import type { OpenClawConfig } from 'openclaw/plugin-sdk/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  API_CLIENT_PARAMS_SLOT,
  GATEWAY_STATUS_START_WATCHDOG_MS,
  type GatewayStatusCoordinator,
  type SharedApiClientParams,
  computeLeaseUntil,
  createGatewayStatusCoordinator,
  gateGatewayStatusActivation,
  getGatewayStatusCoordinator,
  isGatewayStatusEligible,
  runGatewayStatusActivation,
  sendGatewayStop,
  setGatewayStatusCoordinator,
  startGatewayHeartbeatLoop,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';
import { configureTlonApiWithPoke } from './urbit/api-client.js';

vi.mock('@tloncorp/api', () => ({
  configureGatewayStatus: vi.fn().mockResolvedValue(undefined),
  gatewayStart: vi.fn().mockResolvedValue(undefined),
  gatewayHeartbeat: vi.fn().mockResolvedValue(undefined),
  gatewayStop: vi.fn().mockResolvedValue(undefined),
}));

// The heartbeat and sendGatewayStop paths call configureTlonApiWithPoke each
// time to defeat OpenClaw plugin module isolation; in tests we stub it to a
// no-op so the fake @tloncorp/api singleton stays as the vitest mock above.
vi.mock('./urbit/api-client.js', () => ({
  configureTlonApiWithPoke: vi.fn(),
}));

const stubApiClientParams: SharedApiClientParams = {
  poke: vi.fn().mockResolvedValue(undefined),
  shipName: 'test-bot',
  shipUrl: 'http://localhost:8080',
};

/** A promise the test can resolve/reject on its own schedule. */
function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Await `promise`, but fail fast (in ~ms) if it does not settle. The
 * dangerous-schedule cases below resolve purely from synchronous coordinator
 * state transitions the test drives — no real time — so a bounded number of
 * microtask flushes is enough. Without this, a coordinator regression that
 * fails to resolve a waiter would hang the test until the 180s suite timeout
 * instead of failing in milliseconds.
 */
async function expectSettled<T>(
  promise: Promise<T>,
  label: string,
  maxMicrotaskFlushes = 200
): Promise<T> {
  let settled = false;
  // Attach a handler so a rejection is observed here too (no unhandled
  // rejection); the caller still awaits `promise` and sees the outcome.
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    }
  );
  for (let i = 0; i < maxMicrotaskFlushes && !settled; i += 1) {
    await Promise.resolve();
  }
  if (!settled) {
    throw new Error(
      `${label} did not settle within ${maxMicrotaskFlushes} microtask flushes — likely a coordinator regression`
    );
  }
  return promise;
}

beforeEach(() => {
  vi.useFakeTimers();
  // These resolve with the poke response id (a number); the value itself is
  // never asserted on, only that the call happened.
  vi.mocked(configureGatewayStatus).mockClear().mockResolvedValue(1);
  vi.mocked(gatewayStart).mockClear().mockResolvedValue(1);
  vi.mocked(gatewayHeartbeat).mockClear().mockResolvedValue(1);
  vi.mocked(gatewayStop).mockClear().mockResolvedValue(1);
  vi.mocked(configureTlonApiWithPoke).mockClear();
  sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(
    stubApiClientParams
  );
  setGatewayStatusCoordinator(null);
});

afterEach(() => {
  sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
  setGatewayStatusCoordinator(null);
  vi.useRealTimers();
});

describe('gateway-status: createGatewayStatusCoordinator — generations', () => {
  let coordinator: GatewayStatusCoordinator;

  beforeEach(() => {
    coordinator = createGatewayStatusCoordinator({ logger: undefined });
  });

  it('starts idle: generation 0, empty bootId, not stopped', () => {
    expect(coordinator.currentGeneration).toBe(0);
    expect(coordinator.bootId).toBe('');
    expect(coordinator.stopped).toBe(false);
  });

  it('beginGeneration mints generation 1 with a valid UUID bootId', () => {
    const lc = coordinator.beginGeneration();
    expect(lc.generation).toBe(1);
    expect(lc.bootId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(coordinator.currentGeneration).toBe(1);
    expect(coordinator.bootId).toBe(lc.bootId);
  });

  it('duplicate gateway_start (beginGeneration while already started) is a no-op: no extra generation', () => {
    const lc1 = coordinator.beginGeneration();
    const lc2 = coordinator.beginGeneration();
    expect(lc2).toEqual(lc1);
    expect(coordinator.currentGeneration).toBe(1);
  });

  it('beginGeneration after markStopped bumps the generation and mints a fresh bootId', async () => {
    const lc1 = coordinator.beginGeneration();
    await coordinator.markStopped(lc1.generation);
    expect(coordinator.stopped).toBe(true);

    const lc2 = coordinator.beginGeneration();
    expect(lc2.generation).toBe(2);
    expect(lc2.bootId).not.toBe(lc1.bootId);
    expect(coordinator.stopped).toBe(false);
  });

  it('markStarting/markActivated are no-ops for a stale (non-current) generation', () => {
    const lc1 = coordinator.beginGeneration();
    coordinator.markStarting(lc1.generation + 1); // a generation that doesn't exist yet
    coordinator.markActivated(lc1.generation + 1);
    // No observable state change from the stale calls; confirm via the
    // markStopped behavior, which only sends %gateway-stop if
    // starting/activated is true for the CURRENT generation.
    void coordinator.markStopped(lc1.generation);
    expect(gatewayStop).not.toHaveBeenCalled();
  });

  it('markStopped is a no-op (including no poke) if starting/activated was never set', async () => {
    const lc1 = coordinator.beginGeneration();
    await coordinator.markStopped(lc1.generation);
    expect(gatewayStop).not.toHaveBeenCalled();
  });

  it('markStopped sends %gateway-stop when a start was in flight (starting=true)', async () => {
    const lc1 = coordinator.beginGeneration();
    coordinator.markStarting(lc1.generation);
    await coordinator.markStopped(lc1.generation, 'shutdown');
    expect(gatewayStop).toHaveBeenCalledTimes(1);
    expect(vi.mocked(gatewayStop).mock.calls[0][0]).toMatchObject({
      bootId: lc1.bootId,
      reason: 'shutdown',
    });
  });

  it('markStopped sends %gateway-stop when activated=true', async () => {
    const lc1 = coordinator.beginGeneration();
    coordinator.markActivated(lc1.generation);
    await coordinator.markStopped(lc1.generation);
    expect(gatewayStop).toHaveBeenCalledTimes(1);
  });

  it('markStopped is idempotent: a second call for the same generation does not re-poke', async () => {
    const lc1 = coordinator.beginGeneration();
    coordinator.markActivated(lc1.generation);
    await coordinator.markStopped(lc1.generation);
    await coordinator.markStopped(lc1.generation);
    expect(gatewayStop).toHaveBeenCalledTimes(1);
  });

  it('markStopped for a stale generation number is a no-op', async () => {
    const lc1 = coordinator.beginGeneration();
    coordinator.markActivated(lc1.generation);
    await coordinator.markStopped(lc1.generation);
    const lc2 = coordinator.beginGeneration();
    coordinator.markActivated(lc2.generation);
    vi.mocked(gatewayStop).mockClear();

    // A stale/duplicate stop hook firing for the OLD generation must not
    // touch the new one.
    await coordinator.markStopped(lc1.generation);
    expect(gatewayStop).not.toHaveBeenCalled();
    expect(coordinator.stopped).toBe(false);
  });
});

describe('gateway-status: waitForStartedLifecycle', () => {
  let coordinator: GatewayStatusCoordinator;

  beforeEach(() => {
    coordinator = createGatewayStatusCoordinator({ logger: undefined });
  });

  it('resolves immediately if the current lifecycle is already started and not stopped', async () => {
    const lc1 = coordinator.beginGeneration();
    const resolved = await coordinator.waitForStartedLifecycle();
    expect(resolved).toEqual(lc1);
  });

  it('wait-before-first-start: resolves only when the first generation starts', async () => {
    let resolved: { generation: number; bootId: string } | null = null;
    const p = coordinator.waitForStartedLifecycle().then((lc) => {
      resolved = lc;
    });
    await Promise.resolve();
    expect(resolved).toBeNull();

    const lc1 = coordinator.beginGeneration();
    await expectSettled(p, 'wait-before-first-start');
    expect(resolved).toEqual(lc1);
  });

  it('replacement after stop(N), before start(N+1): resolves on N+1, not the stale stopped generation', async () => {
    const lc1 = coordinator.beginGeneration();
    await coordinator.markStopped(lc1.generation);

    let resolved: { generation: number; bootId: string } | null = null;
    const p = coordinator.waitForStartedLifecycle().then((lc) => {
      resolved = lc;
    });
    await Promise.resolve();
    expect(resolved).toBeNull();

    const lc2 = coordinator.beginGeneration();
    await expectSettled(p, 'replacement-after-stop');
    expect(resolved).toEqual(lc2);
    expect((resolved as unknown as { generation: number }).generation).toBe(2);
  });

  it('rejects when the signal aborts while waiting', async () => {
    const controller = new AbortController();
    const p = coordinator.waitForStartedLifecycle(controller.signal);
    controller.abort();
    await expect(p).rejects.toThrow();
  });

  it('rejects immediately if the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      coordinator.waitForStartedLifecycle(controller.signal)
    ).rejects.toThrow();
  });
});

describe('gateway-status: isGatewayStatusEligible', () => {
  it('is false with zero configured accounts', () => {
    expect(isGatewayStatusEligible({ channels: {} } as OpenClawConfig)).toBe(
      false
    );
  });

  it('is true with exactly one configured account', () => {
    expect(
      isGatewayStatusEligible({
        channels: { tlon: { ship: '~zod' } },
      } as OpenClawConfig)
    ).toBe(true);
  });

  it('is false with more than one configured account', () => {
    expect(
      isGatewayStatusEligible({
        channels: {
          tlon: {
            ship: '~zod',
            accounts: { second: { ship: '~bus' } },
          },
        },
      } as OpenClawConfig)
    ).toBe(false);
  });
});

describe('gateway-status: startGatewayHeartbeatLoop', () => {
  it('sends periodic heartbeats while isValid() is true', async () => {
    const stop = startGatewayHeartbeatLoop({
      bootId: 'boot-1',
      isValid: () => true,
    });
    expect(gatewayHeartbeat).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);
    expect(vi.mocked(gatewayHeartbeat).mock.calls[0][0].bootId).toBe('boot-1');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(2);
    stop();
  });

  it('clears itself the tick after isValid() turns false', async () => {
    let valid = true;
    startGatewayHeartbeatLoop({ bootId: 'boot-1', isValid: () => valid });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);

    valid = false;
    await vi.advanceTimersByTimeAsync(30_000);
    // The tick fires, sees isValid() === false, clears itself without poking.
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('stop() clears the interval immediately, before any self-check tick', async () => {
    const stop = startGatewayHeartbeatLoop({
      bootId: 'boot-1',
      isValid: () => true,
    });
    stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(gatewayHeartbeat).not.toHaveBeenCalled();
  });

  it('two independent loops do not affect each other (monitor-local isolation)', async () => {
    const stopA = startGatewayHeartbeatLoop({
      bootId: 'boot-A',
      isValid: () => true,
    });
    startGatewayHeartbeatLoop({ bootId: 'boot-B', isValid: () => true });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(2);

    // Stopping A's loop (as a stale monitor's cleanup would) must not
    // affect B's independent interval.
    stopA();
    await vi.advanceTimersByTimeAsync(30_000);
    const bootIds = vi
      .mocked(gatewayHeartbeat)
      .mock.calls.map((call) => call[0].bootId);
    expect(bootIds.filter((id) => id === 'boot-A')).toHaveLength(1);
    expect(bootIds.filter((id) => id === 'boot-B')).toHaveLength(2);
  });

  it('skips the poke when api-client params are not published', async () => {
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
    startGatewayHeartbeatLoop({ bootId: 'boot-1', isValid: () => true });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).not.toHaveBeenCalled();
  });

  it('calls onError and does not crash when the poke rejects', async () => {
    vi.mocked(gatewayHeartbeat).mockRejectedValueOnce(new Error('boom'));
    const onError = vi.fn();
    startGatewayHeartbeatLoop({
      bootId: 'boot-1',
      isValid: () => true,
      onError,
    });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onError).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(2);
  });
});

describe('gateway-status: runGatewayStatusActivation', () => {
  let coordinator: GatewayStatusCoordinator;

  beforeEach(() => {
    coordinator = createGatewayStatusCoordinator({ logger: undefined });
  });

  it('waits for the lifecycle, sends %configure + %gateway-start, then starts the heartbeat', async () => {
    const registerHeartbeatStop = vi.fn();
    const lc = coordinator.beginGeneration();
    await runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop,
    });

    expect(configureGatewayStatus).toHaveBeenCalledTimes(1);
    expect(gatewayStart).toHaveBeenCalledTimes(1);
    expect(vi.mocked(gatewayStart).mock.calls[0][0]).toMatchObject({
      bootId: lc.bootId,
    });
    expect(registerHeartbeatStop).toHaveBeenCalledTimes(1);

    // configure must precede gateway-start
    const configureOrder = vi.mocked(configureGatewayStatus).mock
      .invocationCallOrder[0];
    const startOrder = vi.mocked(gatewayStart).mock.invocationCallOrder[0];
    expect(configureOrder).toBeLessThan(startOrder);
  });

  it('in-process start→stop→start (no second registerFull): generation 2 gets a fresh bootId and activates', async () => {
    const lc1 = coordinator.beginGeneration();
    await runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
    });
    expect(gatewayStart).toHaveBeenCalledTimes(1);

    await coordinator.markStopped(lc1.generation);
    const lc2 = coordinator.beginGeneration();
    expect(lc2.generation).toBe(2);
    expect(lc2.bootId).not.toBe(lc1.bootId);

    await runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
    });
    expect(gatewayStart).toHaveBeenCalledTimes(2);
    expect(vi.mocked(gatewayStart).mock.calls[1][0]).toMatchObject({
      bootId: lc2.bootId,
    });
  });

  it('stopping the returned heartbeat handle (as cleanup does when eligibility flips false) halts further heartbeats', async () => {
    let stopHandle: (() => void) | undefined;
    coordinator.beginGeneration();
    await runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: (stop) => {
        stopHandle = stop;
      },
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);

    stopHandle?.();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('stop during %configure: no %gateway-start, no heartbeat, no stop handle', async () => {
    const configureCalled = deferred<void>();
    const configureResult = deferred<void>();
    vi.mocked(configureGatewayStatus).mockImplementationOnce(() => {
      configureCalled.resolve();
      return configureResult.promise as unknown as ReturnType<
        typeof configureGatewayStatus
      >;
    });
    const registerHeartbeatStop = vi.fn();

    const lc = coordinator.beginGeneration();
    const activation = runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop,
    });

    await expectSettled(
      configureCalled.promise,
      'stop-during-configure:called'
    );
    await coordinator.markStopped(lc.generation);
    configureResult.resolve();
    await expectSettled(activation, 'stop-during-configure:activation');

    expect(gatewayStart).not.toHaveBeenCalled();
    // No heartbeat loop was ever created (the stop handle callback is only
    // invoked after markActivated + startGatewayHeartbeatLoop).
    expect(registerHeartbeatStop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gatewayHeartbeat).not.toHaveBeenCalled();
  });

  it('stop during %gateway-start: no heartbeat afterward', async () => {
    const startCalled = deferred<void>();
    const startResult = deferred<void>();
    vi.mocked(gatewayStart).mockImplementationOnce(() => {
      startCalled.resolve();
      return startResult.promise as unknown as ReturnType<typeof gatewayStart>;
    });
    const registerHeartbeatStop = vi.fn();

    const lc = coordinator.beginGeneration();
    const activation = runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop,
    });

    await expectSettled(startCalled.promise, 'stop-during-start:called');
    await coordinator.markStopped(lc.generation);
    startResult.resolve();
    await expectSettled(activation, 'stop-during-start:activation');

    expect(registerHeartbeatStop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gatewayHeartbeat).not.toHaveBeenCalled();
  });

  it('bails without activating when isTornDown() is already true', async () => {
    coordinator.beginGeneration();
    await runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => true,
      registerHeartbeatStop: vi.fn(),
    });
    expect(configureGatewayStatus).not.toHaveBeenCalled();
  });

  it('returns silently (no telemetry) when aborted while waiting for the lifecycle to start', async () => {
    const controller = new AbortController();
    const onActivationError = vi.fn();
    const activation = runGatewayStatusActivation({
      coordinator, // never started
      owner: '~zod',
      signal: controller.signal,
      isTornDown: () => false,
      onActivationError,
      registerHeartbeatStop: vi.fn(),
    });
    controller.abort();
    await activation;
    expect(configureGatewayStatus).not.toHaveBeenCalled();
    expect(onActivationError).not.toHaveBeenCalled();
  });

  it('aborting the signal mid-wait (as monitor teardown does) cancels the wait AND clears the watchdog', async () => {
    // Mirrors the monitor-local activation abort composed into the signal:
    // teardown before the gateway ever starts must cancel the pending wait
    // and prevent the watchdog from emitting telemetry after teardown.
    const controller = new AbortController();
    const onWatchdogTimeout = vi.fn();
    const activation = runGatewayStatusActivation({
      coordinator, // never started: the wait would otherwise hang
      owner: '~zod',
      signal: controller.signal,
      isTornDown: () => false,
      onWatchdogTimeout,
      registerHeartbeatStop: vi.fn(),
    });

    controller.abort();
    await expectSettled(activation, 'abort-mid-wait');

    // Watchdog timer was cleared on abort — advancing well past it fires nothing.
    await vi.advanceTimersByTimeAsync(GATEWAY_STATUS_START_WATCHDOG_MS * 2);
    expect(onWatchdogTimeout).not.toHaveBeenCalled();
    expect(configureGatewayStatus).not.toHaveBeenCalled();
  });

  it('watchdog: fires once (log/telemetry-only), never activates, and clears on abort', async () => {
    const onWatchdogTimeout = vi.fn();
    const controller = new AbortController();
    const activation = runGatewayStatusActivation({
      coordinator, // never started: waitForStartedLifecycle never resolves
      owner: '~zod',
      signal: controller.signal,
      isTornDown: () => false,
      onWatchdogTimeout,
      registerHeartbeatStop: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(GATEWAY_STATUS_START_WATCHDOG_MS);
    expect(onWatchdogTimeout).toHaveBeenCalledTimes(1);
    expect(configureGatewayStatus).not.toHaveBeenCalled();

    // One-shot: it does not fire again on further elapsed time.
    await vi.advanceTimersByTimeAsync(GATEWAY_STATUS_START_WATCHDOG_MS * 2);
    expect(onWatchdogTimeout).toHaveBeenCalledTimes(1);

    controller.abort();
    await activation;
    expect(configureGatewayStatus).not.toHaveBeenCalled();
  });

  it('watchdog timer is cleared once the lifecycle starts (no timeout fires after)', async () => {
    const onWatchdogTimeout = vi.fn();
    const activation = runGatewayStatusActivation({
      coordinator,
      owner: '~zod',
      isTornDown: () => false,
      onWatchdogTimeout,
      registerHeartbeatStop: vi.fn(),
    });
    // Resolve the wait almost immediately.
    coordinator.beginGeneration();
    await activation;

    await vi.advanceTimersByTimeAsync(GATEWAY_STATUS_START_WATCHDOG_MS * 2);
    expect(onWatchdogTimeout).not.toHaveBeenCalled();
  });

  it("watchdog timer is unref()'d so it never keeps the process alive", async () => {
    // Wrap the (already-faked) setTimeout so we can spy on the timer object's
    // unref(). The only setTimeout the activation calls before the wait
    // resolves is the watchdog, so any unref() we observe here is its.
    const fakeSetTimeout = globalThis.setTimeout;
    const unrefed: unknown[] = [];
    const spy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      ...args: Parameters<typeof setTimeout>
    ) => {
      const timer = fakeSetTimeout(...args) as ReturnType<typeof setTimeout> & {
        unref?: () => unknown;
      };
      if (typeof timer.unref === 'function') {
        const originalUnref = timer.unref.bind(timer);
        timer.unref = () => {
          unrefed.push(timer);
          return originalUnref();
        };
      }
      return timer;
    }) as typeof setTimeout);

    const activation = runGatewayStatusActivation({
      coordinator, // never started yet
      owner: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
    });
    // The watchdog setTimeout runs synchronously before the first await, so
    // its unref() has already fired by now.
    expect(unrefed.length).toBeGreaterThan(0);

    spy.mockRestore();
    // Let the activation resolve and clean up its watchdog timer.
    coordinator.beginGeneration();
    await activation;
  });
});

// Cases 6 & 7 of the plan, exercised through the SAME gate the monitor runs
// (gateGatewayStatusActivation) rather than the raw isGatewayStatusEligible
// predicate — so these would fail if the monitor's eligibility gate were
// removed or reverted to a stale registration-time value. Each cfg here
// stands in for the channel-start `ctx.cfg` snapshot the monitor threads in;
// the coordinator is reused across "monitors" with no re-registration.
describe('gateway-status: gateGatewayStatusActivation (per-monitor gate)', () => {
  let coordinator: GatewayStatusCoordinator;

  const oneAccount = {
    channels: { tlon: { ship: '~zod' } },
  } as OpenClawConfig;
  const twoAccounts = {
    channels: {
      tlon: { ship: '~zod', accounts: { second: { ship: '~bus' } } },
    },
  } as OpenClawConfig;
  const zeroAccounts = { channels: {} } as OpenClawConfig;

  beforeEach(() => {
    coordinator = createGatewayStatusCoordinator({ logger: undefined });
    // The gate activates against a started lifecycle.
    coordinator.beginGeneration();
  });

  it('activates with a 1-account snapshot (0/>1 → 1 hot reload)', async () => {
    const result = gateGatewayStatusActivation({
      cfg: oneAccount,
      coordinator,
      effectiveOwnerShip: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
    });
    expect(result).not.toBeNull();
    await expectSettled(result as Promise<void>, 'gate:one-account');
    expect(gatewayStart).toHaveBeenCalledTimes(1);
  });

  it('does NOT activate with a >1-account snapshot; reports the skip', () => {
    const onMultiAccountSkip = vi.fn();
    const result = gateGatewayStatusActivation({
      cfg: twoAccounts,
      coordinator,
      effectiveOwnerShip: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
      onMultiAccountSkip,
    });
    expect(result).toBeNull();
    expect(gatewayStart).not.toHaveBeenCalled();
    expect(onMultiAccountSkip).toHaveBeenCalledWith(2);
  });

  it('does NOT activate with a 0-account snapshot and does not report a multi-account skip', () => {
    const onMultiAccountSkip = vi.fn();
    const result = gateGatewayStatusActivation({
      cfg: zeroAccounts,
      coordinator,
      effectiveOwnerShip: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
      onMultiAccountSkip,
    });
    expect(result).toBeNull();
    expect(gatewayStart).not.toHaveBeenCalled();
    expect(onMultiAccountSkip).not.toHaveBeenCalled();
  });

  it('does NOT activate without an owner even with a 1-account snapshot', () => {
    const result = gateGatewayStatusActivation({
      cfg: oneAccount,
      coordinator,
      effectiveOwnerShip: null,
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
    });
    expect(result).toBeNull();
    expect(gatewayStart).not.toHaveBeenCalled();
  });

  it('1 → >1 hot reload without re-registration: old monitor heartbeat stops, replacement does NOT activate', async () => {
    // Monitor A: 1 account → activates + heartbeat, capturing its stop
    // handle exactly as the monitor's registerHeartbeatStop callback does.
    let tornDownA = false;
    let stopHeartbeatA: (() => void) | null = null;
    const activationA = gateGatewayStatusActivation({
      cfg: oneAccount,
      coordinator,
      effectiveOwnerShip: '~zod',
      isTornDown: () => tornDownA,
      registerHeartbeatStop: (stop) => {
        stopHeartbeatA = stop;
      },
    });
    expect(activationA).not.toBeNull();
    await expectSettled(activationA as Promise<void>, 'gate:hot-reload-A');
    expect(gatewayStart).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);

    // Config reload: monitor A is torn down (its cleanup stops its own local
    // heartbeat), then monitor B starts with a >1-account snapshot — same
    // coordinator, NO registerFull re-run.
    tornDownA = true;
    stopHeartbeatA?.();

    const onMultiAccountSkip = vi.fn();
    const activationB = gateGatewayStatusActivation({
      cfg: twoAccounts,
      coordinator,
      effectiveOwnerShip: '~zod',
      isTornDown: () => false,
      registerHeartbeatStop: vi.fn(),
      onMultiAccountSkip,
    });
    expect(activationB).toBeNull();
    expect(onMultiAccountSkip).toHaveBeenCalledWith(2);

    // No replacement activation, and monitor A's heartbeat is dead.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(gatewayStart).toHaveBeenCalledTimes(1);
    expect(gatewayHeartbeat).toHaveBeenCalledTimes(1);
  });
});

describe('gateway-status: coordinator shared-state accessor', () => {
  it('returns null when not set', () => {
    expect(getGatewayStatusCoordinator()).toBeNull();
  });

  it('stores and retrieves the coordinator', () => {
    const coordinator = createGatewayStatusCoordinator({ logger: undefined });
    setGatewayStatusCoordinator(coordinator);
    expect(getGatewayStatusCoordinator()).toBe(coordinator);
  });
});

describe('gateway-status: computeLeaseUntil', () => {
  it('returns a timestamp in the future', () => {
    const now = Date.now();
    const lease = computeLeaseUntil();
    expect(lease).toBeGreaterThan(now);
    // Should be ~90 seconds in the future
    expect(lease - now).toBeGreaterThanOrEqual(89_000);
    expect(lease - now).toBeLessThanOrEqual(91_000);
  });
});

describe('gateway-status: sendGatewayStop', () => {
  beforeEach(() => {
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
  });

  it('returns false and does not poke when params are not published', async () => {
    const sent = await sendGatewayStop({
      bootId: 'boot-1',
      reason: 'shutdown',
    });
    expect(sent).toBe(false);
    expect(gatewayStop).not.toHaveBeenCalled();
  });

  it('configures the api client before sending the stop poke', async () => {
    const params: SharedApiClientParams = {
      poke: vi.fn().mockResolvedValue(undefined),
      shipName: 'test-bot',
      shipUrl: 'http://localhost:8080',
    };
    sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(params);

    const sent = await sendGatewayStop({
      bootId: 'boot-1',
      reason: 'shutdown',
    });
    expect(sent).toBe(true);
    expect(configureTlonApiWithPoke).toHaveBeenCalledTimes(1);
    expect(gatewayStop).toHaveBeenCalledTimes(1);
    // configure must run before the poke so the stop reaches the SSE-bound
    // client in this module's @tloncorp/api instance.
    const configureOrder = vi.mocked(configureTlonApiWithPoke).mock
      .invocationCallOrder[0];
    const stopOrder = vi.mocked(gatewayStop).mock.invocationCallOrder[0];
    expect(configureOrder).toBeLessThan(stopOrder);
  });
});
