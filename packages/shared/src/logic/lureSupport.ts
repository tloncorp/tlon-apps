import { TLON_DESK_MIN_VERSION } from '@tloncorp/api/lib/deskVersion';

import { isVersionBelow, parseVersion } from './semver';

// Whether a backend at the given desk version runs lure entirely in %reel.
// Anything that isn't a fully valid semver returns null (unknown) rather than
// false: enableGroup tries %reel first while unknown and falls back, so an
// unreadable version still works on either side of the change.
export function deskVersionServesLureOnReel(
  deskVersion?: string | null
): boolean | null {
  if (!deskVersion || parseVersion(deskVersion) === null) {
    return null;
  }
  return !isVersionBelow(deskVersion, TLON_DESK_MIN_VERSION);
}
