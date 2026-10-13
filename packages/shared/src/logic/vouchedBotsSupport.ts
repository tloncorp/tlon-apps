import { VOUCHED_BOTS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export { VOUCHED_BOTS_MIN_GROUPS_VERSION };

// Whether a backend at the given groups version serves the virtual-bot
// surfaces (%steward roster, %chat vouched DMs). Conservative, like
// deskVersionSupportsBuckets: a version that isn't fully valid semver reads
// as unsupported.
export function deskVersionSupportsVouchedBots(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, VOUCHED_BOTS_MIN_GROUPS_VERSION);
}
