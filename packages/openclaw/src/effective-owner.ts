/**
 * Shared effective-owner state.
 *
 * The monitor writes to this when ownerShip is loaded or hot-reloaded from
 * the settings store. The heartbeat handler reads from it at event time.
 *
 * Follows the same module-level Map pattern as src/session-roles.ts.
 */

const effectiveOwners = new Map<string, string>();

export function setEffectiveOwnerShip(accountId: string, ship: string | null): void {
  if (ship) {
    effectiveOwners.set(accountId, ship);
  } else {
    effectiveOwners.delete(accountId);
  }
}

export function getEffectiveOwnerShip(accountId: string): string | null {
  return effectiveOwners.get(accountId) ?? null;
}

export const _testing = { clearAll: () => effectiveOwners.clear() };
