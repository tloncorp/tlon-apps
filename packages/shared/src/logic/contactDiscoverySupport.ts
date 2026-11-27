import { CONTACT_DISCOVERY_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export { CONTACT_DISCOVERY_MIN_GROUPS_VERSION };

// Whether a backend at the given groups version records contact discovery in
// %groups-ui. Conservative, like deskVersionSupportsBuckets: a version that
// isn't fully valid semver reads as unsupported.
export function deskVersionSupportsContactDiscovery(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, CONTACT_DISCOVERY_MIN_GROUPS_VERSION);
}
