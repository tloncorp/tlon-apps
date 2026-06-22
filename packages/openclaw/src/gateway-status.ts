import { gatewayHeartbeat, gatewayStop } from '@tloncorp/api';
import { randomUUID } from 'node:crypto';

import { sharedSlot } from './shared-state.js';
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
const HEARTBEAT_INTERVAL_MS = 30_000; // 30s
const LEASE_DURATION_MS = 90_000; // 90s
export const ACTIVE_WINDOW_SECS = 300; // 5 min
export const OFFLINE_REPLY_COOLDOWN_SECS = 300; // 5 min

export function computeLeaseUntil(): number {
  return Date.now() + LEASE_DURATION_MS;
}

// ── Manager interface ───────────────────────────────────────
export interface GatewayStatusManager {
  readonly bootId: string;

  /** Resolve the "gateway started" Promise. Called by gateway_start hook. */
  signalGatewayStarted(): void;

  /** Returns a Promise that resolves when gateway_start has fired. */
  waitForGatewayStart(): Promise<void>;

  /**
   * True once the activation task is about to send the %gateway-start poke
   * (set immediately before the gatewayStart call). Distinguishes "a start
   * poke is/was in flight" from "activation fully completed", so the
   * gateway_stop hook can send a matching %gateway-stop even if shutdown
   * lands before markActivated().
   */
  readonly starting: boolean;
  markStarting(): void;

  /** True after monitor has successfully sent %configure + %gateway-start. */
  readonly activated: boolean;
  markActivated(): void;

  /** True after gateway_stop hook has sent %gateway-stop. */
  readonly stopped: boolean;
  markStopped(): void;

  /** Start heartbeat interval. No-op if not activated or already stopped. */
  startHeartbeat(): void;

  /** Stop heartbeat interval. Idempotent. */
  stopHeartbeat(): void;
}

// ── Factory ─────────────────────────────────────────────────
export function createGatewayStatusManager(opts: {
  logger?: { log?: (msg: string) => void; error?: (msg: string) => void };
}): GatewayStatusManager {
  const bootId = randomUUID();
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let starting = false;
  let activated = false;
  let stopped = false;

  let resolveStarted: () => void;
  const startedPromise = new Promise<void>((r) => {
    resolveStarted = r;
  });

  return {
    bootId,

    signalGatewayStarted() {
      resolveStarted();
    },
    waitForGatewayStart() {
      return startedPromise;
    },

    get starting() {
      return starting;
    },
    markStarting() {
      starting = true;
    },

    get activated() {
      return activated;
    },
    markActivated() {
      activated = true;
    },

    get stopped() {
      return stopped;
    },
    markStopped() {
      stopped = true;
    },

    startHeartbeat() {
      if (stopped || !activated || heartbeatInterval) {
        return;
      }
      heartbeatInterval = setInterval(async () => {
        try {
          // Configure THIS module's @tloncorp/api instance against the
          // monitor-published params every tick. Under OpenClaw plugin
          // module isolation this code path can hold a separate
          // @tloncorp/api instance from the monitor; outbound DMs via
          // `withAuthenticatedTlonApi` can also rotate the global
          // client between heartbeats. Reapplying here keeps the
          // heartbeat poke pointed at the SSE-bound client.
          const params = apiClientParamsSlot.get();
          if (!params) {
            opts.logger?.error?.(
              '[gateway-status] heartbeat skipped: api-client params not published'
            );
            return;
          }
          configureTlonApiWithPoke(
            params.poke,
            params.shipName,
            params.shipUrl
          );
          await gatewayHeartbeat({ bootId, leaseUntil: computeLeaseUntil() });
        } catch (err) {
          opts.logger?.error?.(
            `[gateway-status] heartbeat failed: ${String(err)}`
          );
        }
      }, HEARTBEAT_INTERVAL_MS);
      opts.logger?.log?.(
        `[gateway-status] heartbeat started (interval=${HEARTBEAT_INTERVAL_MS}ms)`
      );
    },

    stopHeartbeat() {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
        opts.logger?.log?.('[gateway-status] heartbeat stopped');
      }
    },
  };
}

// Routed through shared-state so the slot survives plugin module isolation —
// the extension sets, the monitor reads, and they live in separate contexts.
const managerSlot = sharedSlot<GatewayStatusManager>('gateway-status.manager');

export function setGatewayStatusManager(m: GatewayStatusManager | null): void {
  managerSlot.set(m);
}

export function getGatewayStatusManager(): GatewayStatusManager | null {
  return managerSlot.get();
}

// Configure THIS module's @tloncorp/api singleton against the
// monitor-published params, then send the gateway-stop poke. Callers
// (notably the gateway_stop hook in index.ts) must go through this helper
// instead of importing `gatewayStop` directly, because under OpenClaw
// >=2026.4.27 plugin module isolation the entry module's @tloncorp/api
// instance is never configured — only the monitor's is. Routing through
// gateway-status.ts reuses the same configured instance the heartbeat uses.
// Returns true if the poke was sent, false if the params slot was empty.
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
