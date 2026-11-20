import type { BucketsEntry } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import { getBucketPreviewFiles } from './bucketPreviewFiles';

function file(
  id: number,
  name: string,
  parentId: number | null = null,
  status = 'ready'
): BucketsEntry {
  return { id, name, parentId, kind: 'file', file: { status } } as BucketsEntry;
}

describe('Bucket preview file order', () => {
  it('includes all ready file formats in the same folder, ordered as the list', () => {
    const entries = [
      file(1, 'c.zip'),
      file(2, 'a.jpg'),
      file(3, 'b.mp3'),
      file(4, 'nested.pdf', 10),
      file(5, 'pending.jpg', null, 'pending'),
      file(6, 'failed.jpg', null, 'failed'),
      {
        id: 10,
        name: 'Folder',
        kind: 'folder',
        parentId: null,
      } as BucketsEntry,
    ];
    expect(getBucketPreviewFiles(entries, 3).map((entry) => entry.id)).toEqual([
      2, 3, 1,
    ]);
    expect(entries[0].id).toBe(1);
    expect(getBucketPreviewFiles(entries, 4).map((entry) => entry.id)).toEqual([
      4,
    ]);
  });
  it('does not invent a folder before a cold-linked file arrives or after it is deleted', () => {
    expect(getBucketPreviewFiles([file(1, 'photo.jpg')], 99)).toEqual([]);
  });
});
