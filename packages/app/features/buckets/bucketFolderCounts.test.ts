import type { BucketsEntry } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import { buildBucketFolderCounts } from './bucketFolderCounts';

function base(id: number, parentId: number | null) {
  return {
    id,
    parentId,
    name: `entry-${id}`,
    createdBy: '~zod',
    createdAt: 1,
    updatedBy: '~zod',
    updatedAt: 1,
  };
}

function folder(id: number, parentId: number | null = null): BucketsEntry {
  return { ...base(id, parentId), kind: 'folder' };
}

function file(
  id: number,
  parentId: number | null = null,
  status: 'pending' | 'ready' | 'failed' = 'ready'
): BucketsEntry {
  return {
    ...base(id, parentId),
    kind: 'file',
    file: {
      mime: 'text/plain',
      size: 1,
      checksum: null,
      objectKey: `objects/${id}`,
      status,
    },
  };
}

describe('buildBucketFolderCounts', () => {
  it('counts files and folders through every level beneath a folder', () => {
    const counts = buildBucketFolderCounts([
      folder(1),
      folder(2, 1),
      folder(3, 2),
      file(4, 1),
      file(5, 2),
      file(6, 3),
      file(7),
    ]);

    expect(counts.get(1)).toEqual({ fileCount: 3, folderCount: 2 });
    expect(counts.get(2)).toEqual({ fileCount: 2, folderCount: 1 });
    expect(counts.get(3)).toEqual({ fileCount: 1, folderCount: 0 });
  });

  it('skips files that have not finished uploading', () => {
    const counts = buildBucketFolderCounts([
      folder(1),
      file(2, 1, 'pending'),
      file(3, 1, 'failed'),
      file(4, 1),
    ]);

    expect(counts.get(1)).toEqual({ fileCount: 1, folderCount: 0 });
  });

  it('reports zeroes for an empty folder', () => {
    expect(buildBucketFolderCounts([folder(1)]).get(1)).toEqual({
      fileCount: 0,
      folderCount: 0,
    });
  });

  it('stops at a folder that loops back on itself', () => {
    const counts = buildBucketFolderCounts([
      folder(1, 2),
      folder(2, 1),
      file(3, 1),
    ]);

    expect(counts.get(1)).toEqual({ fileCount: 1, folderCount: 1 });
    expect(counts.get(2)).toEqual({ fileCount: 1, folderCount: 1 });
  });
});
