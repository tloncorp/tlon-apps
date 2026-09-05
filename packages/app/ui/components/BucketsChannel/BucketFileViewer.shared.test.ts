import { describe, expect, it } from 'vitest';

import {
  MAX_TEXT_PREVIEW_BYTES,
  canPreviewAsText,
  getBucketPreviewKind,
} from './BucketFileViewer.shared';

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

describe('canPreviewAsText', () => {
  // A text preview reads the whole object into memory, and the backend accepts
  // objects up to 5 GiB, so the size is the gate rather than the type.
  it('refuses a text file past the cap', () => {
    const item = { name: 'export.csv', mimeType: 'text/csv' };
    expect(canPreviewAsText({ ...item, size: MAX_TEXT_PREVIEW_BYTES })).toBe(
      true
    );
    expect(
      canPreviewAsText({ ...item, size: MAX_TEXT_PREVIEW_BYTES + 1 })
    ).toBe(false);
  });

  // Extension alone makes something text, so a renamed dump reaches this path.
  it('gates on size even when only the extension says text', () => {
    expect(
      canPreviewAsText({ name: 'dump.txt', size: 4 * 1024 * 1024 * 1024 })
    ).toBe(false);
  });

  it('still refuses anything that is not text', () => {
    expect(canPreviewAsText({ name: 'clip.mp4', mimeType: 'video/mp4' })).toBe(
      false
    );
  });

  // An entry with no size recorded is allowed through rather than blocked.
  it('allows a text file whose size is unknown', () => {
    expect(canPreviewAsText({ name: 'notes.md' })).toBe(true);
  });
});
