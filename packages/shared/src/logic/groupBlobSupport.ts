import { isVersionBelow, parseVersion } from './semver';

// The first %groups release carrying the group blob: the v3 group surfaces
// (/x/v3 scries, /v3/groups response lane, group-action-5) plus the
// groups-ui /v10/init and /v11/changes arms that embed it. Below the minimum
// the client uses the blob-free v2 surfaces, which a pre-blob backend can
// still serve.
// NOTE: 12.2.0 is the release this ships in. Must move in lockstep with
// desk/desk.docket-0's version if the release number changes.
export const GROUP_BLOB_MIN_GROUPS_VERSION = '12.2.0';

// Whether a backend at the given groups version carries the group blob.
// Conservative by design, mirroring activityVersionSupportsNotes: anything
// that isn't a fully valid semver returns false so we never point the client
// at v3 group surfaces an old backend can't serve.
export function groupsVersionSupportsBlob(
  groupsVersion?: string | null
): boolean {
  if (!groupsVersion || parseVersion(groupsVersion) === null) {
    return false;
  }
  return !isVersionBelow(groupsVersion, GROUP_BLOB_MIN_GROUPS_VERSION);
}
