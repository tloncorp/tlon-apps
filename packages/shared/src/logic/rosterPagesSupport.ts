import { tryParse } from '@urbit/aura';

// Groups above this many members sync with the light roster and load the
// rest a page at a time, when the desk serves pages.
export const PAGED_ROSTER_THRESHOLD = 500;

/**
 * Whether a group's stored roster is whole: a whole-roster sync landed this
 * session (`syncedAt` after its start), and live events have kept it current
 * since. A light sync never sets `syncedAt`, and a sync from an earlier
 * session may have missed changes.
 */
export function isRosterWhole(
  syncedAt: number | null | undefined,
  sessionStartTime: number | undefined
): boolean {
  return (
    sessionStartTime !== undefined &&
    syncedAt != null &&
    syncedAt > sessionStartTime
  );
}

/**
 * Orders ships the way the desk pages them, by @p value. Anything that isn't
 * a ship sorts last.
 */
export function compareShips(a: string, b: string): number {
  const x = tryParse('p', a);
  const y = tryParse('p', b);
  if (x === null || y === null) {
    return x === y ? 0 : x === null ? 1 : -1;
  }
  return x < y ? -1 : x > y ? 1 : 0;
}
