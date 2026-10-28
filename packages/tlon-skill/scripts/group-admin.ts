import { getCurrentUserId, scry } from '@tloncorp/api';

import { normalizeShip } from './api-client';
import { parseNest } from './cli-utils';
import {
  type RawGroupForAdminVerification,
  actingShipCanAdminister,
} from './commands/groups-verification';
import { sleep } from './runtime-deps';

export const VERIFY_ATTEMPTS = 5;
export const VERIFY_DELAY_MS = 500;

export async function getRawGroupForAdminVerification(
  groupId: string
): Promise<RawGroupForAdminVerification> {
  return scry<RawGroupForAdminVerification>({
    app: 'groups',
    path: `/v2/ui/groups/${groupId}`,
  });
}

// The host is the ship in the group flag (`~host/slug`). The backend treats it as
// an admin unconditionally (`se-is-admin`), regardless of seats or roles.
export function getGroupHost(groupId: string): string {
  return normalizeShip(groupId.split('/')[0]);
}

// Mirrors `is-admin` in desk/lib/channel-utils.hoon: for the commands the
// channel host checks itself, the ship hosting the channel administers it
// regardless of its group roles.
export function actingShipHostsChannel(nest: string): boolean {
  return (
    normalizeShip(parseNest(nest).host) === normalizeShip(getCurrentUserId())
  );
}

/**
 * Refuse an admin mutation up front when the acting ship can't perform it, instead
 * of firing a poke that a foreign host silently drops while the CLI reports success.
 *
 * A poke ack means "my ship forwarded this," not "the host applied it" — so this
 * reads the group's actual state and checks the acting ship is the host or an admin
 * before any mutation runs. `action` is the user-facing verb (e.g. "promote").
 *
 * Retries like the post-poke verification paths: on a foreign-hosted group the local
 * snapshot can lag a just-granted admin role, so a single stale read shouldn't hard
 * fail an action the host would now accept. The happy path returns on the first
 * attempt; only a (transient or genuine) rejection waits.
 */
export async function assertActingShipCanAdminister(
  groupId: string,
  action: string
): Promise<void> {
  const actingShip = normalizeShip(getCurrentUserId());
  const hostShip = getGroupHost(groupId);

  let lastReason: string | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawGroup = await getRawGroupForAdminVerification(groupId);
      const result = actingShipCanAdminister(
        rawGroup,
        actingShip,
        hostShip,
        normalizeShip
      );
      if (result.ok) {
        return;
      }
      lastReason = result.reason;
    } catch (err) {
      lastError = err;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  if (lastReason) {
    throw new Error(`Can't ${action} in ${groupId}: ${lastReason}`);
  }

  throw new Error(
    `Can't ${action} in ${groupId}: could not read group state: ${lastError}`
  );
}

/**
 * Scry-poll the group's state until `isSatisfied` holds, returning the snapshot
 * that satisfied it. On exhaustion, throws `describeFailure` of the last snapshot
 * read (undefined when every read failed).
 */
export async function verifyRawGroupState(
  groupId: string,
  isSatisfied: (rawGroup: RawGroupForAdminVerification) => boolean,
  describeFailure: (
    lastSnapshot: RawGroupForAdminVerification | undefined
  ) => string
): Promise<RawGroupForAdminVerification> {
  let lastSnapshot: RawGroupForAdminVerification | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawGroup = await getRawGroupForAdminVerification(groupId);
      lastSnapshot = rawGroup;
      if (isSatisfied(rawGroup)) {
        return rawGroup;
      }
    } catch (err) {
      lastError = err;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await sleep(VERIFY_DELAY_MS);
    }
  }

  const suffix = lastError ? ` (last error: ${lastError})` : '';
  throw new Error(`${describeFailure(lastSnapshot)}${suffix}`);
}
