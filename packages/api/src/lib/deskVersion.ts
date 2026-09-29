const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+].+)?$/;

// Parse a full semver string into its numeric core, or null if the entire
// string is not a valid semver (a partially parseable prefix like
// "11.2.2 dirty" returns null, not [11, 2, 2]).
export function parseVersion(version: string): [number, number, number] | null {
  const match = SEMVER_RE.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareCore(a: string, b: string): number {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);
  if (!parsedA || !parsedB) return 0;
  for (let i = 0; i < 3; i++) {
    if (parsedA[i] !== parsedB[i]) return parsedA[i] - parsedB[i];
  }
  return 0;
}

export function isVersionBelow(current: string, minimum: string): boolean {
  return compareCore(current, minimum) < 0;
}

// Oldest %groups desk this client supports. Ships reporting a lower docket
// version get the desk-outdated notice instead of an empty home (12.2.0 =
// first desk with /v10/init and the /v3/groups subscription, which the
// client currently requires with no fallback).
//
// By policy this is the previous desk release
// (docs/tlon-apps/desk-compatibility.md). This constant RECORDS the floor;
// it is NOT the lever for shipping a new desk dependency: a client change
// needing something only the current desk serves waits for that desk to
// become N-1, or carries a fallback tested against N-1. Raise it only as
// part of a release, once the desk release it names has shipped and the
// N-1 E2E job passes against it. The registry check
// (client/requests/floor.test.ts) fails any non-exempt declared desk request
// whose `since` is above it unless it names a guard.
export const MIN_GROUPS_VERSION = '12.2.0';

// The first %groups release with %buckets and /v11/init (/v10 plus Buckets
// and their writer roles). It sits above MIN_GROUPS_VERSION, so the supported
// 12.2.x band passes the desk gate without %buckets at all: everything
// buckets-specific is gated on this version (getDeskSupportsBuckets), not on
// the gate alone. Guarded registry entries name it as their `since`. Must
// move in lockstep with desk/desk.docket-0's version if the release number
// changes.
export const BUCKETS_MIN_GROUPS_VERSION = '12.3.0';
