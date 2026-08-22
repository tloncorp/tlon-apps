/**
 * Channel read-permission predicate, mirroring the backend model in
 * desk/app/groups.hoon:
 *
 *   1. the group host always reads everything
 *   2. non-members read nothing
 *   3. banned ships read nothing
 *   4. an empty reader set means every member may read
 *   5. otherwise the ship needs a seat role intersecting the reader set
 *
 * This runs against a snapshot of group state supplied by the caller.
 * chat/heap/diary channels only — %notes group-mode notebooks defer to the
 * group's can-read upstream, but resolve audience per channel kind and fail
 * closed on anything unrecognized.
 */

export interface GroupSnapshot {
  /** Group host ship (the `~host` in `~host/group-name`). */
  hostShip: string;
  /** Seats: member ship → role ids held. */
  seats: ReadonlyMap<string, readonly string[]>;
  /** Banned ships (rank bans should be pre-expanded by the caller). */
  bannedShips?: ReadonlySet<string>;
  /** Channel reader role ids by nest; empty array = all members. */
  channelReaders: ReadonlyMap<string, readonly string[]>;
}

const KNOWN_KINDS = new Set(['chat', 'heap', 'diary']);

export function canRead(
  ship: string,
  nest: string,
  group: GroupSnapshot
): boolean {
  const kind = nest.split('/', 1)[0];
  if (!KNOWN_KINDS.has(kind)) {
    return false;
  }
  if (ship === group.hostShip) {
    return true;
  }
  const roles = group.seats.get(ship);
  if (!roles) {
    return false;
  }
  if (group.bannedShips?.has(ship)) {
    return false;
  }
  const readers = group.channelReaders.get(nest);
  if (readers === undefined) {
    // Unknown channel: fail closed.
    return false;
  }
  if (readers.length === 0) {
    return true;
  }
  return roles.some((role) => readers.includes(role));
}

/**
 * Whether everyone who can read `fromNest` can also read `intoNest` — the
 * containment check behind "a memory may enter a surface only if everyone
 * who can see that surface is entitled to it".
 */
export function audienceContains(
  intoNest: string,
  fromNest: string,
  group: GroupSnapshot
): boolean {
  for (const ship of group.seats.keys()) {
    if (canRead(ship, intoNest, group) && !canRead(ship, fromNest, group)) {
      return false;
    }
  }
  return true;
}
