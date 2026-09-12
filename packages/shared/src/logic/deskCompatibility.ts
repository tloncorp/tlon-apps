import { isVersionBelow, parseVersion } from './semver';

// The oldest %groups desk this client supports: by policy, the previous desk
// release (docs/tlon-apps/desk-compatibility.md). Ships below it get the
// desk-outdated notice instead of an empty home.
//
// This constant RECORDS the floor. It is NOT the lever for shipping a new desk
// dependency: a client change needing something only the current desk serves
// waits for that desk to become N-1, or carries a fallback tested against N-1.
// Raise it only as part of a release, once the desk release it names has
// shipped and `pnpm check:desk-compat` passes — and re-pin the ~bus pier in the
// same change (apps/tlon-web/e2e/shipManifest.json).
export const MIN_GROUPS_VERSION = '12.2.0';

export type DeskVersionClassification = 'ok' | 'outdated' | 'unknown';

/**
 * Classify the %groups desk version reported by the ship's docket metadata.
 *
 * Fails open by design. The label is a proxy for path availability, not proof
 * of it — a dev checkout can carry stale metadata alongside new code — so
 * anything we can't read as a full semver ('n/a' when the charge is missing,
 * a partially parseable '12.2.0 dirty', a bare '12.2') is 'unknown' and the
 * app starts normally. Only a version we can parse *and* that sits strictly
 * below the minimum gates startup.
 */
export function classifyDeskVersion(
  groupsVersion?: string | null
): DeskVersionClassification {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return 'unknown';
  }
  return isVersionBelow(groupsVersion, MIN_GROUPS_VERSION) ? 'outdated' : 'ok';
}
