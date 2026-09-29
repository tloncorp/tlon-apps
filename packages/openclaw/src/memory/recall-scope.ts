/**
 * v2 recall scope: audience-containment instead of same-surface-only.
 *
 * The governing rule (design doc, TLON-6375): recalled content may enter a
 * surface only if everyone who can see that surface was entitled to the
 * source. Applied per surface:
 *
 *   DM with ~x   → the DM itself, plus every indexed channel ~x can read
 *                  (audience is exactly ~x, who was entitled to all of it)
 *   channel C    → C itself, plus siblings D in the same group whose reader
 *                  roles contain C's (readers(D) ⊇ readers(C), or D open to
 *                  all members) — everyone who can read C can read D
 *
 * Never crossed, in either direction: other people's DMs, and channels the
 *current audience cannot read. Everything unknown fails closed: missing
 * group mapping, the `__unknown__` reader sentinel, or seats that were not
 * captured all exclude the source rather than admitting it.
 */
import {
  getChannelIndexEntry,
  getGroupIndexEntry,
  getSeatRoles,
  listIndexedGroupFlags,
} from './group-index.js';
import { parseTlonSurface, stripActiveMemorySuffix } from './surface.js';

/** Bound the SQL key list; beyond this the widest sources are dropped. */
const MAX_SCOPE_KEYS = 96;

const UNKNOWN_READERS = '__unknown__';

function readersKnown(readers: readonly string[]): boolean {
  return !readers.includes(UNKNOWN_READERS);
}

/** Group host ship from a group flag (`~host/name`). Hosts read everything. */
function groupHostShip(groupFlag: string): string {
  return groupFlag.split('/', 1)[0];
}

/** Whether `ship` can read `nest`, from index state; unknown fails closed. */
export function canShipReadNest(ship: string, nest: string): boolean {
  const entry = getChannelIndexEntry(nest);
  if (!entry || !readersKnown(entry.readers)) {
    return false;
  }
  if (ship === groupHostShip(entry.groupFlag)) {
    return true;
  }
  const roles = getSeatRoles(entry.groupFlag, ship);
  if (roles === undefined) {
    return false;
  }
  if (entry.readers.length === 0) {
    return true;
  }
  return roles.some((role) => entry.readers.includes(role));
}

/**
 * Whether content from sibling `sourceNest` may enter `currentNest`:
 * everyone who can read current must be able to read source. Role-set
 * containment implies audience containment without needing seats.
 */
export function siblingReadableFromCurrent(
  currentNest: string,
  sourceNest: string
): boolean {
  const current = getChannelIndexEntry(currentNest);
  const source = getChannelIndexEntry(sourceNest);
  if (!current || !source || current.groupFlag !== source.groupFlag) {
    return false;
  }
  if (!readersKnown(current.readers) || !readersKnown(source.readers)) {
    return false;
  }
  if (source.readers.length === 0) {
    return true; // open to every member — superset of any sibling audience
  }
  if (current.readers.length === 0) {
    return false; // current is all-members; source is narrower
  }
  return current.readers.every((role) => source.readers.includes(role));
}

/**
 * Build the LCM session keys `tlon_recall` may search for a calling session.
 * Channel nests are emitted in both observed key spellings (`group`, and
 * legacy `channel`); absent keys simply match nothing.
 */
export function buildRecallSessionKeys(callingSessionKey: string): string[] {
  const base = stripActiveMemorySuffix(callingSessionKey.trim());
  const surface = parseTlonSurface(base);
  const prefixMatch = /^(agent:[^:]+:tlon):/.exec(base);
  if (!surface || !prefixMatch) {
    return [];
  }
  const prefix = prefixMatch[1];
  const channelKeys = (nest: string) => [
    `${prefix}:group:${nest}`,
    `${prefix}:channel:${nest}`,
  ];

  const keys: string[] = [];
  if (surface.kind === 'dm') {
    keys.push(`${prefix}:direct:${surface.ship}`);
    for (const nest of allIndexedNests()) {
      if (canShipReadNest(surface.ship, nest)) {
        keys.push(...channelKeys(nest));
      }
      if (keys.length >= MAX_SCOPE_KEYS) {
        break;
      }
    }
  } else {
    keys.push(...channelKeys(surface.nest));
    const entry = getChannelIndexEntry(surface.nest);
    const group = entry ? getGroupIndexEntry(entry.groupFlag) : undefined;
    for (const sibling of group?.channels ?? []) {
      if (sibling === surface.nest) {
        continue;
      }
      if (siblingReadableFromCurrent(surface.nest, sibling)) {
        keys.push(...channelKeys(sibling));
      }
      if (keys.length >= MAX_SCOPE_KEYS) {
        break;
      }
    }
  }
  return keys.slice(0, MAX_SCOPE_KEYS);
}

function allIndexedNests(): string[] {
  const seen = new Set<string>();
  const nests: string[] = [];
  for (const groupFlag of listIndexedGroupFlags()) {
    const group = getGroupIndexEntry(groupFlag);
    for (const nest of group?.channels ?? []) {
      if (!seen.has(nest)) {
        seen.add(nest);
        nests.push(nest);
      }
    }
  }
  return nests;
}
