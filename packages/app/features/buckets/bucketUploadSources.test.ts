import { describe, expect, it } from 'vitest';

import {
  clearUploadRunning,
  forgetUpload,
  isUploadCancelled,
  markUploadCancelled,
  markUploadRunning,
} from './bucketUploadSources';

describe('cancellation while a runner is in flight', () => {
  // Cancelling retires the row, which forgets everything held for it. The
  // marker has to outlive that: a runner waiting on a grant can only see the
  // cancellation at its next checkpoint, and clearing it here meant the
  // runner came back, found nothing cancelled, and went on to upload and
  // publish the file the user had just cancelled.
  it('keeps the marker until the runner clears it', () => {
    markUploadRunning('upload-1');
    markUploadCancelled('upload-1');

    forgetUpload('upload-1');
    expect(isUploadCancelled('upload-1')).toBe(true);

    clearUploadRunning('upload-1');
    expect(isUploadCancelled('upload-1')).toBe(false);
  });

  // Nothing is going to observe it, so it would sit in the set for the life
  // of the process.
  it('drops the marker when no runner is left to see it', () => {
    markUploadCancelled('upload-2');

    forgetUpload('upload-2');
    expect(isUploadCancelled('upload-2')).toBe(false);
  });
});
