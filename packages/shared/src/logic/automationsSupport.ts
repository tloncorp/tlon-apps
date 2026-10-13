import { AUTOMATIONS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

// Whether a backend at the given groups version serves scheduled tasks the
// way the client uses them, delivery block included. A version that is not
// fully valid semver counts as unsupported, as deskVersionSupportsBuckets
// does, so the task screens stay hidden on a ship whose version is unknown.
export function deskVersionSupportsAutomations(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, AUTOMATIONS_MIN_GROUPS_VERSION);
}
