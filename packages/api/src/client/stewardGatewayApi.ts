import { da, dr, render } from '@urbit/aura';

import type * as ub from '../urbit';
import { pokeRequest, steward } from './requests';

/**
 * Build a raw poke payload for %steward's gateway module.
 * Temporal fields must already be in @da/@dr string format.
 */
export function stewardGatewayAction(action: ub.StewardGatewayAction) {
  return {
    app: steward.gatewayAction.agent,
    mark: steward.gatewayAction.mark,
    json: action,
  };
}

const pokeGateway = pokeRequest(steward.gatewayAction);

/**
 * Configure the gateway module. The owner is shared across all of %steward's
 * modules, so it rides the core %steward-action-1 mark; only the timing
 * parameters belong to the gateway module itself. Both pokes are idempotent
 * and safe to resend on every startup.
 *
 * @param owner - @p string of the owner ship, e.g. "~zod"
 * @param activeWindowSecs - owner activity window in seconds
 * @param offlineReplyCooldownSecs - minimum seconds between auto-replies
 */
export async function configureStewardGateway(params: {
  owner: string;
  activeWindowSecs: number;
  offlineReplyCooldownSecs: number;
}) {
  // Owner first: the gateway module refuses start/heartbeat/stop until the
  // core owner is set, so a reordering here would leave the harness inert.
  await pokeRequest(steward.action)({
    configure: { owner: params.owner },
  } satisfies ub.StewardConfigure);

  return pokeGateway({
    configure: {
      'active-window': render(
        'dr',
        dr.fromSeconds(BigInt(params.activeWindowSecs))
      ),
      'offline-reply-cooldown': render(
        'dr',
        dr.fromSeconds(BigInt(params.offlineReplyCooldownSecs))
      ),
    },
  } satisfies ub.StewardGatewayAction);
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
  return pokeGateway({
    'gateway-start': {
      'boot-id': params.bootId,
      'lease-until': render('da', da.fromUnix(params.leaseUntil)),
    },
  } satisfies ub.StewardGatewayAction);
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
  return pokeGateway({
    'gateway-heartbeat': {
      'boot-id': params.bootId,
      'lease-until': render('da', da.fromUnix(params.leaseUntil)),
    },
  } satisfies ub.StewardGatewayAction);
}

/**
 * Signal that a gateway instance has stopped.
 * @param params.bootId - must match the current boot-id; stale stops are ignored
 * @param params.reason - human-readable reason for stopping
 */
export async function gatewayStop(params: { bootId: string; reason: string }) {
  return pokeGateway({
    'gateway-stop': { 'boot-id': params.bootId, reason: params.reason },
  } satisfies ub.StewardGatewayAction);
}
