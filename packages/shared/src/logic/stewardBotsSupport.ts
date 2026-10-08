import { STEWARD_BOTS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export { STEWARD_BOTS_MIN_GROUPS_VERSION };

// Whether a backend at the given groups version serves %steward's trusted
// bots. Conservative, like deskVersionSupportsBuckets: a version that isn't
// fully valid semver reads as unsupported.
export function deskVersionSupportsStewardBots(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, STEWARD_BOTS_MIN_GROUPS_VERSION);
}
