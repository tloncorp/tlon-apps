import { da, dr, render } from '@urbit/aura';

import type * as ub from '../urbit';
import { poke } from './urbit';

/**
 * Build a raw poke payload for %steward's gateway module.
 * Temporal fields must already be in @da/@dr string format.
 */
export function stewardGatewayAction(action: ub.StewardGatewayAction) {
  return {
    app: 'steward',
    mark: 'steward-gateway-action-1',
    json: action,
  };
}

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
  await poke({
    app: 'steward',
    mark: 'steward-action-1',
    json: { configure: { owner: params.owner } } satisfies ub.StewardConfigure,
  });

  return poke(
    stewardGatewayAction({
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
    })
  );
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
  const action = stewardGatewayAction({
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
  const action = stewardGatewayAction({
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
  const action = stewardGatewayAction({
    'gateway-stop': { 'boot-id': params.bootId, reason: params.reason },
  });
  return poke(action);
}
