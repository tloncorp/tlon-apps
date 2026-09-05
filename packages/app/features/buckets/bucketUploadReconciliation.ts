import type { BucketsResponse, BucketsSnapshot } from '@tloncorp/api';

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
  uploads: readonly {
    serverEntryId?: number | null;
    state?: string;
  }[]
): Set<number> {
  return new Set(
    uploads
      // A completed row is no longer standing in for anything -- it is kept
      // only so the aggregate progress bar keeps its denominator. Suppressing
      // on it hid the very entry the upload had just published, so the file
      // vanished on success and came back on reload, when the row was swept.
      .filter((upload) => upload.state !== 'completed')
      .map((upload) => upload.serverEntryId)
      // null, not just undefined: the stored column uses null for "not yet".
      .filter((id): id is number => id !== undefined && id !== null)
  );
}
