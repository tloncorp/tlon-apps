import { getCurrentUserId, scry } from '@tloncorp/api';

import { normalizeShip } from './api-client';
import {
  type RawGroupForAdminVerification,
  actingShipCanAdminister,
} from './commands/groups-verification';

const VERIFY_ATTEMPTS = 5;
const VERIFY_DELAY_MS = 500;

export type GroupAdminRuntimeDeps = {
  getActingShip: () => string;
  getRawGroup: (groupId: string) => Promise<RawGroupForAdminVerification>;
  sleep: (ms: number) => Promise<void>;
};

const runtimeDeps: GroupAdminRuntimeDeps = {
  getActingShip: () => getCurrentUserId(),
  getRawGroup: (groupId) =>
    scry<RawGroupForAdminVerification>({
      app: 'groups',
      path: `/v2/ui/groups/${groupId}`,
    }),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Fail closed before a group mutation when the acting ship is neither the host
 * nor an admin. Foreign group snapshots can lag a newly granted admin role, so
 * rejection is retried before it becomes final. Hosts bypass the remote read:
 * the backend always treats the group host as an admin.
 */
export async function assertGroupAdminAccess(
  groupId: string,
  action: string,
  deps: GroupAdminRuntimeDeps = runtimeDeps
): Promise<void> {
  const actingShip = normalizeShip(deps.getActingShip());
  const hostShip = normalizeShip(groupId.split('/')[0] ?? '');
  if (actingShip === hostShip) return;

  let lastReason: string | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt += 1) {
    try {
      const rawGroup = await deps.getRawGroup(groupId);
      const result = actingShipCanAdminister(
        rawGroup,
        actingShip,
        hostShip,
        normalizeShip
      );
      if (result.ok) return;
      lastReason = result.reason;
    } catch (error) {
      lastError = error;
    }

    if (attempt < VERIFY_ATTEMPTS) {
      await deps.sleep(VERIFY_DELAY_MS);
    }
  }

  if (lastReason) {
    throw new Error(`Can't ${action} in ${groupId}: ${lastReason}`);
  }

  throw new Error(
    `Can't ${action} in ${groupId}: could not read group state: ${String(lastError)}`
  );
}
