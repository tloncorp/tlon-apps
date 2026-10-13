import { STEWARD_PROMPTS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

export { STEWARD_PROMPTS_MIN_GROUPS_VERSION };

// Whether a backend at the given groups version serves the %steward prompts
// routes. Conservative, like deskVersionSupportsBuckets: a version that isn't
// fully valid semver reads as unsupported.
export function deskVersionSupportsStewardPrompts(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, STEWARD_PROMPTS_MIN_GROUPS_VERSION);
}
