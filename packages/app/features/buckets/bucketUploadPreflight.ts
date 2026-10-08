import type { BucketUploadCandidate } from '../../ui';

/**
 * The largest object the host accepts: its +max-object-size, which mirrors
 * Memex's BUCKETS_MAX_OBJECT_BYTES default. The host stays the authority --
 * this only stops a file it would certainly refuse from waiting in the queue
 * and spending a grant to find out.
 */
export const MAX_UPLOAD_BYTES = 5_368_709_120;

/**
 * Why the host would refuse this file, or null if it would not on size.
 *
 * Checked when files are selected, so a refusal shows up at once as a failed
 * row with its reason rather than after the rest of the selection has queued
 * ahead of it, and without a request to the host.
 */
export function uploadCandidateProblem(
  candidate: Pick<BucketUploadCandidate, 'size'>
): string | null {
  // Every picker reports a whole byte count, or -1 when the provider would
  // not say.
  if (candidate.size < 0) {
    return 'The file size could not be determined';
  }
  if (candidate.size === 0) {
    return 'Empty files cannot be uploaded';
  }
  if (candidate.size > MAX_UPLOAD_BYTES) {
    return 'Files larger than 5 GB cannot be uploaded';
  }
  return null;
}
