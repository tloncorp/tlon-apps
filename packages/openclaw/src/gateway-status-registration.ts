import type { OpenClawPluginApi } from 'openclaw/plugin-sdk/core';

import {
  type GatewayStatusCoordinator,
  type GatewayStatusCoordinatorLogger,
  createGatewayStatusCoordinator,
  getGatewayStatusCoordinator,
  setGatewayStatusCoordinator,
} from './gateway-status.js';

// registerFull is NOT a once-per-process call: OpenClaw invokes it once per
// load pass (tool discovery, full channel activation, and — on 6.11+ —
// a ~10s post-startup runtime-plugin prewarm that re-runs it into a
// separate plugin registry). `gateway_start`/`gateway_stop` are fire-once,
// non-latched hooks bound against whichever registry is active when they
// fire, so a listener registered into a stale or replaced registry is
// simply never invoked.
//
// This helper is therefore built to be called on EVERY registerFull pass:
// it gets-or-creates the process-lifetime coordinator (via the shared-state
// slot in gateway-status.ts, which survives plugin module isolation) and
// (re)binds the hooks onto the CURRENT pass's `api`. Reusing the same
// coordinator instance across passes — instead of nulling and recreating it
// — is what lets a gateway_start that fires against a later pass's registry
// still resolve the same lifecycle a monitor is waiting on.

export interface RegisterGatewayStatusHooksOptions {
  logger: GatewayStatusCoordinatorLogger;
}

/**
 * Idempotently wires up the process-lifetime gateway-status coordinator
 * against `api`. Safe to call on every `registerFull` pass — see module
 * doc comment above.
 */
export function registerGatewayStatusHooks(
  api: Pick<OpenClawPluginApi, 'on'>,
  regOpts: RegisterGatewayStatusHooksOptions
): GatewayStatusCoordinator {
  const coordinator =
    getGatewayStatusCoordinator() ??
    (() => {
      const created = createGatewayStatusCoordinator({
        logger: regOpts.logger,
      });
      setGatewayStatusCoordinator(created);
      return created;
    })();

  api.on('gateway_start', () => {
    const lc = coordinator.beginGeneration();
    regOpts.logger.log?.(
      `[gateway-status] gateway_start received (generation=${lc.generation})`
    );
  });

  // Return the promise (do NOT `void` it): OpenClaw awaits promises returned
  // from gateway_stop handlers before tearing down channel monitors, so the
  // handler must stay pending until the %gateway-stop poke settles.
  // Discarding it lets shutdown race ahead of the poke, leaving steward %up
  // until the lease expires (and can drop the restart-notice behavior).
  api.on('gateway_stop', (event) =>
    coordinator.markStopped(coordinator.currentGeneration, event.reason)
  );

  return coordinator;
}
