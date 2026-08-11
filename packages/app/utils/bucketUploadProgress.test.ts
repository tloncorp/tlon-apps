import { describe, expect, it } from 'vitest';

import {
  calculateBucketUploadProgress,
  completeBucketUploadInBatch,
  removeBucketUploadFromBatch,
} from './bucketUploadProgress';

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

describe('Bucket upload batch lifecycle', () => {
  const activeBatch = [
    { id: 'movie', progress: 60, size: 50_000_000, state: 'active' as const },
    { id: 'photo', progress: 99, size: 600_000, state: 'active' as const },
  ];

  it('retains a completed upload while another upload is active', () => {
    const withCompletedPhoto = completeBucketUploadInBatch(
      activeBatch,
      'photo'
    );
    expect(withCompletedPhoto).toEqual([
      activeBatch[0],
      { ...activeBatch[1], progress: 100, state: 'completed' },
    ]);
    expect(calculateBucketUploadProgress(withCompletedPhoto)).toBe(
      calculateBucketUploadProgress(activeBatch)
    );
  });

  it('clears the batch after its final upload completes', () => {
    const withCompletedPhoto = completeBucketUploadInBatch(
      activeBatch,
      'photo'
    );
    expect(completeBucketUploadInBatch(withCompletedPhoto, 'movie')).toEqual(
      []
    );
  });

  it('clears completed history when the last active upload is cancelled', () => {
    const withCompletedPhoto = completeBucketUploadInBatch(
      activeBatch,
      'photo'
    );
    expect(removeBucketUploadFromBatch(withCompletedPhoto, 'movie')).toEqual(
      []
    );
  });
});
