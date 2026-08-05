import {
  configureGatewayStatus,
  gatewayHeartbeat,
  gatewayStart,
  gatewayStop,
} from '@tloncorp/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerGatewayStatusHooks } from './gateway-status-registration.js';
import {
  API_CLIENT_PARAMS_SLOT,
  type SharedApiClientParams,
  getGatewayStatusCoordinator,
  setGatewayStatusCoordinator,
} from './gateway-status.js';
import { sharedSlot } from './shared-state.js';

vi.mock('@tloncorp/api', () => ({
  configureGatewayStatus: vi.fn().mockResolvedValue(undefined),
  gatewayStart: vi.fn().mockResolvedValue(undefined),
  gatewayHeartbeat: vi.fn().mockResolvedValue(undefined),
  gatewayStop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./urbit/api-client.js', () => ({
  configureTlonApiWithPoke: vi.fn(),
}));

const stubApiClientParams: SharedApiClientParams = {
  poke: vi.fn().mockResolvedValue(undefined),
  shipName: 'test-bot',
  shipUrl: 'http://localhost:8080',
};

/** A promise the test can settle on its own schedule. */
function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Flush a bounded number of microtasks so a would-be-pending promise proves itself pending. */
async function flushMicrotasks(times = 20): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

/**
 * A minimal fake plugin `api` — just enough of `OpenClawPluginApi` for
 * `registerGatewayStatusHooks` (only `.on(...)`). Each instance models one
 * `registerFull` pass's own hook registry: handlers registered on it are
 * separate from handlers registered on any other instance, mirroring how
 * OpenClaw builds a fresh `api`/registry per load pass.
 */
function createFakeHookApi() {
  // A structural stand-in for the real generic `<K>(hookName: K, handler:
  // PluginHookHandlerMap[K]) => void` signature can't be typed precisely
  // without reproducing that whole generic map; `any` is the pragmatic
  // escape hatch OpenClaw's own SDK types force here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = new Map<string, ((...args: any[]) => unknown)[]>();
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on: vi.fn((event: string, handler: (...args: any[]) => unknown) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
    fire: async (event: string, payload: unknown = {}) => {
      const list = handlers.get(event) ?? [];
      for (const handler of list) {
        await handler(payload);
      }
    },
  };
}

beforeEach(() => {
  // These resolve with the poke response id (a number); the value itself is
  // never asserted on, only that the call happened.
  vi.mocked(configureGatewayStatus).mockClear().mockResolvedValue(1);
  vi.mocked(gatewayStart).mockClear().mockResolvedValue(1);
  vi.mocked(gatewayHeartbeat).mockClear().mockResolvedValue(1);
  vi.mocked(gatewayStop).mockClear().mockResolvedValue(1);
  sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(
    stubApiClientParams
  );
  setGatewayStatusCoordinator(null);
});

afterEach(() => {
  sharedSlot<SharedApiClientParams>(API_CLIENT_PARAMS_SLOT).set(null);
  setGatewayStatusCoordinator(null);
});

describe('registerGatewayStatusHooks', () => {
  it('creates the coordinator on the first call and reuses it on later calls', () => {
    const api1 = createFakeHookApi();
    const c1 = registerGatewayStatusHooks(api1, {
      logger: {},
    });
    expect(getGatewayStatusCoordinator()).toBe(c1);

    const api2 = createFakeHookApi();
    const c2 = registerGatewayStatusHooks(api2, {
      logger: {},
    });
    expect(c2).toBe(c1);
    expect(getGatewayStatusCoordinator()).toBe(c1);
  });

  it('rebinds gateway_start/gateway_stop on every pass', () => {
    const api1 = createFakeHookApi();
    registerGatewayStatusHooks(api1, { logger: {} });
    const api2 = createFakeHookApi();
    registerGatewayStatusHooks(api2, { logger: {} });

    expect(api1.on).toHaveBeenCalledWith('gateway_start', expect.any(Function));
    expect(api1.on).toHaveBeenCalledWith('gateway_stop', expect.any(Function));
    expect(api2.on).toHaveBeenCalledWith('gateway_start', expect.any(Function));
    expect(api2.on).toHaveBeenCalledWith('gateway_stop', expect.any(Function));
  });

  it('three-registry prewarm regression: discovery creates the coordinator, full reuses it and its gateway_start resolves it, prewarm reuses it without re-firing start, and its gateway_stop closes over the SAME coordinator', async () => {
    // Pass 1: tool discovery — registerFull(api) with no channel load.
    const discoveryApi = createFakeHookApi();
    const discoveryCoordinator = registerGatewayStatusHooks(discoveryApi, {
      logger: {},
    });

    // Pass 2: full channel activation — a DIFFERENT api/registry.
    const fullApi = createFakeHookApi();
    const fullCoordinator = registerGatewayStatusHooks(fullApi, {
      logger: {},
    });
    expect(fullCoordinator).toBe(discoveryCoordinator);

    // Only the full pass's registry actually receives the gateway_start
    // emit in real OpenClaw (the runtime registry). Firing it here resolves
    // the SAME coordinator instance.
    await fullApi.fire('gateway_start', { port: 80 });
    expect(fullCoordinator.currentGeneration).toBe(1);
    const lc = await fullCoordinator.waitForStartedLifecycle();
    expect(lc.generation).toBe(1);

    // Pass 3: the 6.11/7.1 post-startup runtime-plugin prewarm — ANOTHER
    // separate api/registry, ~10s later. It must reuse the coordinator
    // rather than orphaning it behind a fresh, never-resolved one.
    const prewarmApi = createFakeHookApi();
    const prewarmCoordinator = registerGatewayStatusHooks(prewarmApi, {
      logger: {},
    });
    expect(prewarmCoordinator).toBe(discoveryCoordinator);
    // The prewarm pass's registry never receives its own gateway_start
    // (core only emits it once, against the runtime registry) — generation
    // stays at 1, already resolved.
    expect(prewarmCoordinator.currentGeneration).toBe(1);

    // The prewarm pass's gateway_stop hook — bound against prewarmApi's
    // registry — must still latch and stop the SAME coordinator/generation
    // that the full pass's gateway_start resolved (not a phantom, still-
    // pending manager B, which is the pre-fix deadlock).
    await prewarmApi.fire('gateway_stop', { reason: 'shutdown' });
    expect(prewarmCoordinator.stopped).toBe(true);
    expect(discoveryCoordinator.stopped).toBe(true);
    expect(discoveryCoordinator.currentGeneration).toBe(1);
    // No %gateway-stop poke, though: activation never reached the start
    // poke in this test (only the gateway_start hook fired), so there is
    // nothing for the ship to stop.
    expect(gatewayStop).not.toHaveBeenCalled();
  });

  it('duplicate gateway_start across two passes does not create an extra generation', async () => {
    const api1 = createFakeHookApi();
    const coordinator = registerGatewayStatusHooks(api1, { logger: {} });
    await api1.fire('gateway_start', { port: 80 });
    expect(coordinator.currentGeneration).toBe(1);

    const api2 = createFakeHookApi();
    registerGatewayStatusHooks(api2, { logger: {} });
    // A duplicate emit (e.g. a stray re-fire against a later pass) must not
    // mint generation 2 while generation 1 is still started.
    await api2.fire('gateway_start', { port: 80 });
    expect(coordinator.currentGeneration).toBe(1);
  });

  it('gateway_stop latches the coordinator stopped and sends %gateway-stop when a start was activated', async () => {
    const api1 = createFakeHookApi();
    const coordinator = registerGatewayStatusHooks(api1, { logger: {} });
    await api1.fire('gateway_start', { port: 80 });
    coordinator.markActivated(coordinator.currentGeneration);

    await api1.fire('gateway_stop', { reason: 'shutdown' });
    expect(coordinator.stopped).toBe(true);
    expect(gatewayStop).toHaveBeenCalledTimes(1);
  });

  it('gateway_stop handler stays pending until the %gateway-stop poke settles, and forwards the reason', async () => {
    // OpenClaw awaits promises returned from gateway_stop handlers before
    // tearing down channels; the handler must not resolve until the poke
    // settles (else shutdown races the poke, leaving steward %up until lease
    // expiry). The fake api's fire() awaits the handler, so a pending poke
    // keeps fire() pending too.
    const pokeSettled = deferred<number>();
    vi.mocked(gatewayStop).mockReturnValueOnce(pokeSettled.promise);

    const api1 = createFakeHookApi();
    const coordinator = registerGatewayStatusHooks(api1, { logger: {} });
    await api1.fire('gateway_start', { port: 80 });
    coordinator.markActivated(coordinator.currentGeneration);

    let handlerResolved = false;
    const firePromise = api1
      .fire('gateway_stop', { reason: 'restart' })
      .then(() => {
        handlerResolved = true;
      });

    await flushMicrotasks();
    // Poke is in flight → the handler (and thus fire) must still be pending.
    expect(handlerResolved).toBe(false);
    expect(gatewayStop).toHaveBeenCalledTimes(1);
    expect(vi.mocked(gatewayStop).mock.calls[0][0]).toMatchObject({
      reason: 'restart',
    });

    pokeSettled.resolve(1);
    await firePromise;
    expect(handlerResolved).toBe(true);
  });
});
