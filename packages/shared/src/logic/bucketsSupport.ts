import { isVersionBelow, parseVersion } from './semver';

// The first %groups release whose /v11/init exists: /v10 plus Buckets and
// their writer roles. Below the minimum the client asks for /v10, which is
// exactly what those backends serve — a Bucket learned from the group alone
// then arrives without its writers until the %buckets subscription fills them
// in, which is the correct degradation rather than a failed init.
//
// NOTE: this sits above deskCompatibility's MIN_GROUPS_VERSION (12.2.0), so
// there is a supported band -- 12.2.x -- that passes the desk gate without
// having %buckets at all. Everything buckets-specific has to be gated on this
// predicate rather than on the gate alone: the init endpoint, and the
// subscription, which would otherwise watch an agent that is not there.
// 12.3.0 is the release this branch ships in. Must move in lockstep
// with desk/desk.docket-0's version if the release number changes.
export const BUCKETS_MIN_GROUPS_VERSION = '12.3.0';

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
