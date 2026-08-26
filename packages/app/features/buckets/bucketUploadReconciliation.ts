import type { BucketsResponse, BucketsSnapshot } from '@tloncorp/api';

export function bucketResponseHasRevisionGap(
  snapshot: BucketsSnapshot | null,
  response: BucketsResponse
) {
  return (
    response.type === 'update' &&
    snapshot !== null &&
    response.revision > snapshot.state.revision + 1
  );
}

/**
 * Server entries that an optimistic upload row is already standing in for.
 *
 * A pending upload is invisible to the manifest until its object lands, so the
 * only overlap is the moment between the entry being published and the local
 * row being cleared. The upload knows its own entry id — the host returns it
 * when granting the upload — so no matching against snapshot metadata is
 * needed to find it.
 */
export function findUploadShadowEntryIds(
  uploads: readonly { serverEntryId?: number }[]
): Set<number> {
  return new Set(
    uploads
      .map((upload) => upload.serverEntryId)
      .filter((id): id is number => id !== undefined)
  );
}

export function removeEntryFromBucketSnapshot(
  snapshot: BucketsSnapshot,
  entryId: number
): BucketsSnapshot {
  return {
    ...snapshot,
    state: {
      ...snapshot.state,
      entries: snapshot.state.entries.filter((entry) => entry.id !== entryId),
    },
  };
}
