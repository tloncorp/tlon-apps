import type { BucketUploadCandidate } from '../../ui';
import type { BucketUploadTask } from './bucketUploadTask.types';

/**
 * The parts of an upload that cannot be written down.
 *
 * A candidate's source is a File handle or a local URI belonging to the
 * process that picked it, and the transfer is a live XHR. Neither survives
 * serialization, so they live here — module-level rather than in a component,
 * so leaving the Bucket does not end the upload.
 *
 * An upload row with nothing here is therefore one this process did not
 * start: its bytes are unreachable, whatever the row says.
 */
const sources = new Map<string, BucketUploadCandidate>();
const tasks = new Map<string, BucketUploadTask>();
const cancelled = new Set<string>();

export function rememberUploadSource(
  id: string,
  candidate: BucketUploadCandidate
) {
  sources.set(id, candidate);
}

export function uploadSource(id: string) {
  return sources.get(id);
}

export function trackUploadTask(id: string, task: BucketUploadTask) {
  tasks.set(id, task);
}

export function uploadTask(id: string) {
  return tasks.get(id);
}

export function markUploadCancelled(id: string) {
  cancelled.add(id);
}

export function isUploadCancelled(id: string) {
  return cancelled.has(id);
}

export function clearUploadCancelled(id: string) {
  cancelled.delete(id);
}

/** Forget everything held for one upload, cancelling its transfer if live. */
export function forgetUpload(id: string) {
  tasks
    .get(id)
    ?.cancel()
    .catch(() => undefined);
  tasks.delete(id);
  sources.delete(id);
  cancelled.delete(id);
}

export function hasUploadSource(id: string) {
  return sources.has(id);
}
