import { ROSTER_PAGES_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';
import { tryParse } from '@urbit/aura';

import { isVersionBelow, parseVersion } from './semver';

export { ROSTER_PAGES_MIN_GROUPS_VERSION };

// Groups above this many members sync with the light roster and load the
// rest a page at a time, when the desk serves pages.
export const PAGED_ROSTER_THRESHOLD = 500;

// Whether a backend at the given groups version serves the light ui group and
// seat pages. Conservative, like deskVersionSupportsBuckets: a version that
// isn't fully valid semver keeps syncing the whole roster.
export function deskVersionServesRosterPages(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, ROSTER_PAGES_MIN_GROUPS_VERSION);
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
