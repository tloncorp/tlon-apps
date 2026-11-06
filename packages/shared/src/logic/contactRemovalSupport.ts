import { CONTACT_REMOVAL_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export function deskVersionSupportsContactRemoval(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, CONTACT_REMOVAL_MIN_GROUPS_VERSION);
}
