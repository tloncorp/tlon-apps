import { isVersionBelow } from './semver';

// The first deployed %groups release that ships reaction support: the v9
// %activity endpoints (v6 feed, v5 subscription, activity-action-1 /
// activity-event-1 marks) plus react emission. The reactions code is on develop
// but unreleased; the latest deployed version is 11.2.2, so this is the next
// release. Below it, the client uses the pre-reaction endpoints (v5 feed, v4
// subscription, v8 marks), which work on older backends.
// TODO(reactions): confirm this matches the release that actually deploys reactions.
export const REACTIONS_MIN_GROUPS_VERSION = '11.3.0';

// Whether a backend at the given groups version supports reactions. Conservative
// by design: anything unparseable (e.g. 'n/a' when the version scry failed)
// returns false, so we never point the client at v9 endpoints an old backend
// can't serve.
export function backendVersionSupportsReactions(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || !/^\d+\.\d+\.\d+/.test(groupsVersion)) {
    return false;
  }
  return !isVersionBelow(groupsVersion, REACTIONS_MIN_GROUPS_VERSION);
}
