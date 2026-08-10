import { isVersionBelow, parseVersion } from './semver';

// The first %groups release whose %activity ships notes support: the v10
// endpoints (v7 feed, v6 subscription, activity-action-2 / activity-event-2
// marks) plus %notes event emission. Below the minimum, the client uses the
// reaction-era (or older) endpoints, which never surface notes activity.
// NOTE: placeholder until the backend release that includes notes activity is
// cut — update to the actual shipped version before this lands in a release.
export const NOTES_ACTIVITY_MIN_GROUPS_VERSION = '12.1.0';

// Whether a backend at the given groups version supports notes activity.
// Conservative by design, mirroring activityVersionSupportsReactions: anything
// that isn't a fully valid semver returns false so we never point the client
// at v10 endpoints an old backend can't serve.
export function activityVersionSupportsNotes(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, NOTES_ACTIVITY_MIN_GROUPS_VERSION);
}
