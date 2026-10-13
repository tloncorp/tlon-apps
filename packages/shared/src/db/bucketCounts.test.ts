import type { BucketsEntry } from '@tloncorp/api';
import { expect, test } from 'vitest';

import * as db from '../db';
import { setupDatabaseTestSuite } from '../test/helpers';

setupDatabaseTestSuite();

const channelId = 'buckets/~zod/files';

function entryBase(id: number, parentId: number | null, name: string) {
  return {
    id,
    parentId,
    name,
    createdBy: '~zod',
    createdAt: 1,
    updatedBy: '~zod',
    updatedAt: 1,
  };
}

function folder(id: number, name: string, parentId: number | null = null) {
  return { ...entryBase(id, parentId, name), kind: 'folder' } as const;
}

function file(
  id: number,
  name: string,
  parentId: number | null = null,
  status: 'pending' | 'ready' | 'failed' = 'ready'
): BucketsEntry {
  return {
    ...entryBase(id, parentId, name),
    kind: 'file',
    file: {
      mime: 'text/plain',
      size: 10,
      checksum: null,
      objectKey: `objects/${id}`,
      status,
    },
  };
}

test('getBucketCountsByChannel counts ready files and every folder', async () => {
  await db.replaceBucketEntries({
    channelId,
    revision: 1,
    entries: [
      folder(1, 'Designs'),
      folder(2, 'Archive', 1),
      file(3, 'root.txt'),
      file(4, 'nested.txt', 1),
      file(5, 'deep.txt', 2),
      file(6, 'uploading.txt', null, 'pending'),
      file(7, 'broken.txt', 1, 'failed'),
    ],
  });

  await expect(db.getBucketCountsByChannel()).resolves.toEqual({
    [channelId]: { fileCount: 3, folderCount: 2 },
  });
});

test('getBucketCountsByChannel reports zeroes for an empty Bucket', async () => {
  await db.replaceBucketEntries({ channelId, revision: 1, entries: [] });

  await expect(db.getBucketCountsByChannel()).resolves.toEqual({
    [channelId]: { fileCount: 0, folderCount: 0 },
  });
});

test('getBucketCountsByChannel scopes counts to each Bucket', async () => {
  const otherChannelId = 'buckets/~zod/other';
  await db.replaceBucketEntries({
    channelId,
    revision: 1,
    entries: [folder(1, 'Designs'), file(2, 'a.txt', 1), file(3, 'b.txt')],
  });
  // Entry ids are per-Bucket, so the same ids appear in both.
  await db.replaceBucketEntries({
    channelId: otherChannelId,
    revision: 1,
    entries: [file(1, 'only.txt')],
  });

  await expect(db.getBucketCountsByChannel()).resolves.toEqual({
    [channelId]: { fileCount: 2, folderCount: 1 },
    [otherChannelId]: { fileCount: 1, folderCount: 0 },
  });
});

test('getBucketCountsByChannel follows entry updates and deletions', async () => {
  await db.replaceBucketEntries({
    channelId,
    revision: 1,
    entries: [folder(1, 'Designs'), file(2, 'a.txt', 1, 'pending')],
  });
  await db.upsertBucketEntry({
    channelId,
    revision: 2,
    entry: file(2, 'a.txt', 1, 'ready'),
  });

  await expect(db.getBucketCountsByChannel()).resolves.toEqual({
    [channelId]: { fileCount: 1, folderCount: 1 },
  });

  await db.deleteBucketEntries({ channelId, revision: 3, entryIds: [1] });

  await expect(db.getBucketCountsByChannel()).resolves.toEqual({
    [channelId]: { fileCount: 1, folderCount: 0 },
  });

  await db.deleteBucket(channelId);

  await expect(db.getBucketCountsByChannel()).resolves.toEqual({});
});
