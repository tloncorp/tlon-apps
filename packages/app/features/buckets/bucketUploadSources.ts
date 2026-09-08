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
const running = new Set<string>();

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

/**
 * The window in which a cancellation still has to be observed.
 *
 * A runner spends most of its life waiting on someone else -- the host for a
 * grant, storage for the bytes -- and a cancel arriving in one of those gaps
 * can only be seen at the next checkpoint. Between marking and observing, the
 * tombstone is the whole of the cancellation, so it outlives the row.
 */
export function markUploadRunning(id: string) {
  running.add(id);
}

export function clearUploadRunning(id: string) {
  running.delete(id);
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
  // Not while a runner is still going. Cancelling an upload retires its row,
  // and clearing the marker here meant a runner waiting on a grant came back
  // to find nothing cancelled: it went on to PUT the bytes and publish the
  // file the user had just cancelled. The runner clears this on its way out.
  if (!running.has(id)) cancelled.delete(id);
}

export function hasUploadSource(id: string) {
  return sources.has(id);
}
