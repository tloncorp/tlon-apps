import { describe, expect, it } from 'vitest';

import {
  MAX_UPLOAD_BYTES,
  uploadCandidateProblem,
} from './bucketUploadPreflight';

describe('uploadCandidateProblem', () => {
  it('accepts a file the host would take', () => {
    expect(uploadCandidateProblem({ size: 1 })).toBeNull();
    expect(uploadCandidateProblem({ size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it('rejects an empty file, as the host does', () => {
    expect(uploadCandidateProblem({ size: 0 })).toMatch(/Empty/);
  });

  it('rejects a file one byte over the limit', () => {
    expect(uploadCandidateProblem({ size: MAX_UPLOAD_BYTES + 1 })).toMatch(
      /larger than 5 GB/
    );
  });

  it('rejects an unknown size rather than guessing', () => {
    // The native picker reports -1 when a provider omits the size.
    expect(uploadCandidateProblem({ size: -1 })).toMatch(/could not be/);
  });
});
