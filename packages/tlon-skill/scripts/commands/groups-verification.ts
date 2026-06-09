/**
 * Pure, side-effect-free predicates for verifying group admin state.
 *
 * Kept free of `./api-client` (and therefore of the live `@tloncorp/api` client
 * singleton) so it can be unit-tested without standing up the API client. Ship
 * normalization is threaded in via a `normalizeShip` argument rather than imported,
 * for the same reason — callers pass the canonical normalizer.
 */

/**
 * Narrow view of the `/v2/ui/groups/{id}` scry response — only the fields the
 * admin-verification flows read. A subset of `@tloncorp/api`'s `GroupV7`.
 */
export type RawGroupForAdminVerification = {
  admins?: string[];
  seats?: Record<string, { roles?: string[] }>;
  admissions?: {
    banned?: { ships?: string[] };
    pending?: Record<string, string[]>;
    invited?: Record<string, unknown>;
  };
};

export type NormalizeShip = (ship: string) => string;

/**
 * Look up a ship-keyed record value, matching on the raw key first and falling
 * back to a normalized comparison so unnormalized record keys still resolve.
 */
export function getShipRecordValue<T>(
  record: Record<string, T> | undefined,
  ship: string,
  normalizeShip: NormalizeShip
): T | undefined {
  if (!record) {
    return undefined;
  }

  const direct = record[ship];
  if (direct !== undefined) {
    return direct;
  }

  const target = normalizeShip(ship);
  return Object.entries(record).find(
    ([key]) => normalizeShip(key) === target
  )?.[1];
}

/** Does the ship's seat currently hold `roleId`? */
export function seatHasRole(
  rawGroup: RawGroupForAdminVerification,
  ship: string,
  roleId: string,
  normalizeShip: NormalizeShip
): boolean {
  const seat = getShipRecordValue(rawGroup.seats, ship, normalizeShip);
  return seat?.roles?.includes(roleId) ?? false;
}

/** Is the ship currently seated (a member) in the group? */
export function shipIsSeated(
  rawGroup: RawGroupForAdminVerification,
  ship: string,
  normalizeShip: NormalizeShip
): boolean {
  return getShipRecordValue(rawGroup.seats, ship, normalizeShip) !== undefined;
}

/** Is the ship currently in the group's ban list? */
export function shipIsBanned(
  rawGroup: RawGroupForAdminVerification,
  ship: string,
  normalizeShip: NormalizeShip
): boolean {
  const banned = rawGroup.admissions?.banned?.ships ?? [];
  const target = normalizeShip(ship);
  return banned.some((bandedShip) => normalizeShip(bandedShip) === target);
}

/**
 * May the acting ship perform admin mutations on this group? The host can always
 * administer; otherwise the acting ship's seat must hold a role the group marks as
 * an admin role (`rawGroup.admins`), which covers custom admin roles, not just the
 * literal `admin` role.
 *
 * The `reason` states only the permission fact (no command verb) — the caller
 * prepends the action-specific wording.
 */
export function actingShipCanAdminister(
  rawGroup: RawGroupForAdminVerification,
  actingShip: string,
  hostShip: string,
  normalizeShip: NormalizeShip
): { ok: true } | { ok: false; reason: string } {
  const normalizedActing = normalizeShip(actingShip);
  const normalizedHost = normalizeShip(hostShip);

  if (normalizedActing === normalizedHost) {
    return { ok: true };
  }

  const adminRoles = rawGroup.admins ?? [];
  const seat = getShipRecordValue(rawGroup.seats, actingShip, normalizeShip);
  const isAdmin =
    seat?.roles?.some((roleId) => adminRoles.includes(roleId)) ?? false;

  if (isAdmin) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `you (${normalizedActing}) are not an admin of this group. It's hosted by ${normalizedHost}. Ask the host to grant admin.`,
  };
}
