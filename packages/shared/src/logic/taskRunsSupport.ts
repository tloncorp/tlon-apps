import { TASK_RUNS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

// Whether a backend at the given groups version pages a scheduled task's runs
// and relays test runs. Conservative, like deskVersionSupportsAutomations: a
// version that isn't fully valid semver reads as unsupported.
export function deskVersionSupportsTaskRuns(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, TASK_RUNS_MIN_GROUPS_VERSION);
}
