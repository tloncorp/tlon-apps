import { CONTACT_DECISIONS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export function deskVersionSupportsContactDecisions(
  groupsVersion?: string | null
): boolean {
  return (
    !!groupsVersion &&
    parseVersion(groupsVersion) !== null &&
    !isVersionBelow(groupsVersion, CONTACT_DECISIONS_MIN_GROUPS_VERSION)
  );
}
