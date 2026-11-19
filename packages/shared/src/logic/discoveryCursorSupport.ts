import { DISCOVERY_CURSOR_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export { DISCOVERY_CURSOR_MIN_GROUPS_VERSION };

// Whether a backend at the given groups version keeps the contact discovery
// cursor in %lanyard. A version that isn't fully valid semver reads as
// unsupported, which keeps the client-held cursor every desk accepts.
export function deskVersionKeepsDiscoveryCursor(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, DISCOVERY_CURSOR_MIN_GROUPS_VERSION);
}
