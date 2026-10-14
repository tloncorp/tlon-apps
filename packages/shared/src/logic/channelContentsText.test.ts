import { describe, expect, test } from 'vitest';

import { formatBucketContents } from './channelContentsText';

describe('formatBucketContents', () => {
  test('counts files and folders', () => {
    expect(formatBucketContents({ fileCount: 25, folderCount: 4 })).toBe(
      '25 files in 4 folders'
    );
  });

  test('omits folders when there are none', () => {
    expect(formatBucketContents({ fileCount: 3, folderCount: 0 })).toBe(
      '3 files'
    );
  });

  test('singularizes', () => {
    expect(formatBucketContents({ fileCount: 1, folderCount: 1 })).toBe(
      '1 file in 1 folder'
    );
  });

  test('reads as empty when there are no files', () => {
    expect(formatBucketContents({ fileCount: 0, folderCount: 0 })).toBe(
      'No files'
    );
    expect(formatBucketContents({ fileCount: 0, folderCount: 2 })).toBe(
      'No files in 2 folders'
    );
  });
});
