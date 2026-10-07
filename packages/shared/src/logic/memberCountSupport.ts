import { FULL_MEMBER_COUNT_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export { FULL_MEMBER_COUNT_MIN_GROUPS_VERSION };

// Whether a backend at the given groups version counts every seat in its init
// and changes member counts. Conservative, like deskVersionSupportsBuckets: a
// version that isn't fully valid semver keeps a count of 15 suspect.
export function deskVersionCountsAllSeats(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, FULL_MEMBER_COUNT_MIN_GROUPS_VERSION);
}
