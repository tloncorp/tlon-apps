import { describe, expect, it } from 'vitest';

import { getBucketPreviewKind } from './BucketFileViewer.shared';

describe('getBucketPreviewKind', () => {
  it.each([
    ['photo.jpg', 'image/jpeg', 'image'],
    ['demo.mp4', 'video/mp4', 'video'],
    ['notes.md', undefined, 'text'],
    ['report.pdf', undefined, 'pdf'],
    ['archive.zip', 'application/zip', 'unsupported'],
  ] as const)('classifies %s as %s', (name, mimeType, expected) => {
    expect(getBucketPreviewKind({ name, mimeType })).toBe(expected);
  });
});
