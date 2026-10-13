import { BUCKETS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

// Below the minimum the client asks for /v10/init, which is exactly what those
// backends serve -- a Bucket learned from the group alone then arrives without
// its writers until the %buckets subscription fills them in, which is the
// correct degradation rather than a failed init.
export { BUCKETS_MIN_GROUPS_VERSION };

// Whether a backend at the given groups version serves /v11/init.
// Conservative by design, mirroring activityVersionSupportsNotes: anything
// that isn't a fully valid semver returns false, so an unknown version asks
// for the endpoint every backend has rather than one that 404s and takes the
// whole high-priority batch down with it.
export function deskVersionSupportsBuckets(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, BUCKETS_MIN_GROUPS_VERSION);
}
