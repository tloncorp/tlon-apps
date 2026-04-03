import { da, dr, render } from '@urbit/aura';

import type * as ub from '../urbit';
import { poke } from './urbit';

/**
 * Build a raw poke payload for the %gateway-status agent.
 * Temporal fields must already be in @da/@dr string format.
 */
export function gatewayStatusAction(action: ub.GatewayStatusAction) {
  return {
    app: 'gateway-status',
    mark: 'gateway-status-action-1',
    json: action,
  };
}

/**
 * Configure the gateway-status agent.
 * @param owner - @p string of the owner ship, e.g. "~zod"
 * @param activeWindowSecs - owner activity window in seconds
 * @param offlineReplyCooldownSecs - minimum seconds between auto-replies
 */
export async function configureGatewayStatus(params: {
  owner: string;
  activeWindowSecs: number;
  offlineReplyCooldownSecs: number;
}) {
  const action = gatewayStatusAction({
    configure: {
      owner: params.owner,
      'active-window': render(
        'dr',
        dr.fromSeconds(BigInt(params.activeWindowSecs))
      ),
      'offline-reply-cooldown': render(
        'dr',
        dr.fromSeconds(BigInt(params.offlineReplyCooldownSecs))
      ),
    },
  });
  return poke(action);
}

/**
 * Signal that a gateway instance has started.
 * @param bootId - opaque boot identifier
 * @param leaseUntil - lease expiry as Unix milliseconds
 */
export async function gatewayStart(params: {
  bootId: string;
  leaseUntil: number;
}) {
  const action = gatewayStatusAction({
    'gateway-start': {
      'boot-id': params.bootId,
      'lease-until': render('da', da.fromUnix(params.leaseUntil)),
    },
  });
  return poke(action);
}

/**
 * Extend the lease for an active gateway instance.
 * @param bootId - must match the current boot-id
 * @param leaseUntil - new lease expiry as Unix milliseconds
 */
export async function gatewayHeartbeat(params: {
  bootId: string;
  leaseUntil: number;
}) {
  const action = gatewayStatusAction({
    'gateway-heartbeat': {
      'boot-id': params.bootId,
      'lease-until': render('da', da.fromUnix(params.leaseUntil)),
    },
  });
  return poke(action);
}

/**
 * Signal that a gateway instance has stopped.
 * @param params.bootId - must match the current boot-id; stale stops are ignored
 * @param params.reason - human-readable reason for stopping
 */
export async function gatewayStop(params: { bootId: string; reason: string }) {
  const action = gatewayStatusAction({
    'gateway-stop': { 'boot-id': params.bootId, reason: params.reason },
  });
  return poke(action);
}
