import {
  MIN_GROUPS_VERSION,
  isVersionBelow,
  parseVersion,
} from '@tloncorp/api/lib/deskVersion';

export { MIN_GROUPS_VERSION };

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
