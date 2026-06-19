import { isVersionBelow, parseVersion } from './semver';

// The first deployed %groups release that ships reaction support: the v9
// %activity endpoints (v6 feed, v5 subscription, activity-action-1 /
// activity-event-1 marks) plus react emission. 11.4.0 is the confirmed
// reactions release; 11.3.0 is the previous release without it. Below the
// minimum, the client uses the pre-reaction endpoints (v5 feed, v4
// subscription, v8 marks), which work on older backends.
export const REACTIONS_MIN_GROUPS_VERSION = '11.4.0';

// Whether a backend at the given groups version supports reactions. Conservative
// by design: anything that isn't a fully valid semver (e.g. 'n/a' when the
// version scry failed, or a partially parseable '11.2.2 dirty' from docket
// metadata) returns false, so we never point the client at v9 endpoints an old
// backend can't serve. A loose prefix check is not enough: it would admit
// '11.2.2 dirty', which then fails the strict parse inside isVersionBelow and is
// silently treated as equal to the minimum (returning true).
export function activityVersionSupportsReactions(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, REACTIONS_MIN_GROUPS_VERSION);
}
