import { describe, expect, it } from 'vitest';

import { calculateBucketUploadProgress } from './bucketUploadProgress';

describe('calculateBucketUploadProgress', () => {
  it('weights each upload by its byte size', () => {
    expect(
      calculateBucketUploadProgress([
        { progress: 60, size: 50 * 1024 * 1024 },
        { progress: 100, size: 600 * 1024 },
      ])
    ).toBe(60);
  });

  it('falls back to an average when no item has a measurable size', () => {
    expect(
      calculateBucketUploadProgress([
        { progress: 40, size: 0 },
        { progress: 80, size: -1 },
      ])
    ).toBe(60);
  });

  it('clamps invalid progress values', () => {
    expect(
      calculateBucketUploadProgress([
        { progress: -20, size: 1 },
        { progress: 120, size: 1 },
      ])
    ).toBe(50);
  });
});
