import { isVersionBelow, parseVersion } from './semver';

// The first %groups release carrying the %notes bounded-search endpoint
// (`/notes/~/v1/notebooks/{host}/{name}/search/bounded/text`, plus its scry).
// 12.0.1 is the previous release, which has no search arm at all — asking it
// would 404.
export const NOTES_SEARCH_MIN_GROUPS_VERSION = '12.1.0';

/**
 * Whether the local %notes agent can serve a notebook search.
 *
 * This is our own ship's version, not the notebook host's: %notes replicates
 * notebook state locally and our ship answers the search from that replica, so
 * a hit is bounded by what we can serve rather than what the host runs.
 *
 * Conservative like the reactions gate: anything that isn't a fully valid
 * semver — 'n/a' when the version scry failed, or a partially parseable
 * '12.1.0 dirty' from docket metadata — reads as unsupported, so the client
 * never offers a search an older backend would reject. A loose prefix check
 * isn't enough: it would admit '12.1.0 dirty', which then fails the strict
 * parse inside isVersionBelow and is silently treated as equal to the minimum.
 */
export function groupsVersionSupportsNotesSearch(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, NOTES_SEARCH_MIN_GROUPS_VERSION);
}
