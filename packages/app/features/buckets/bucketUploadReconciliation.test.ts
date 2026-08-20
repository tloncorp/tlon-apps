import type { BucketsSnapshot } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import {
  bucketResponseHasRevisionGap,
  findUploadShadowEntryIds,
  removeEntryFromBucketSnapshot,
} from './bucketUploadReconciliation';

const snapshot = {
  flag: { host: '~zod', name: 'project-files' },
  state: {
    bucket: {
      createdAt: 1,
      createdBy: '~zod',
      id: 1,
      title: 'Project Files',
      updatedAt: 1,
      updatedBy: '~zod',
    },
    entries: [
      {
        createdAt: 1,
        createdBy: '~zod',
        file: {
          checksum: null,
          mime: 'image/heic',
          objectKey: 'first',
          size: 42,
          status: 'ready',
        },
        id: 10,
        kind: 'file',
        name: 'IMG_0111.heic',
        parentId: null,
        updatedAt: 1,
        updatedBy: '~zod',
      },
    ],
    group: { host: '~zod', name: 'group' },
    revision: 2,
    writers: ['admin'],
  },
} satisfies BucketsSnapshot;

describe('findUploadShadowEntryIds', () => {
  it('hides the entry an upload row already stands for', () => {
    expect(
      findUploadShadowEntryIds([{ serverEntryId: 10 }, { serverEntryId: 11 }])
    ).toEqual(new Set([10, 11]));
  });

  it('hides nothing for an upload that has no entry yet', () => {
    expect(findUploadShadowEntryIds([{}])).toEqual(new Set());
  });
});

describe('removeEntryFromBucketSnapshot', () => {
  it('optimistically removes an entry', () => {
    const next = removeEntryFromBucketSnapshot(snapshot, 10);
    expect(next.state.entries).toEqual([]);
  });

  it('leaves unrelated entries alone', () => {
    const next = removeEntryFromBucketSnapshot(snapshot, 999);
    expect(next.state.entries).toHaveLength(1);
  });
});

describe('bucketResponseHasRevisionGap', () => {
  it('requests a refresh when an update skips a revision', () => {
    expect(
      bucketResponseHasRevisionGap(snapshot, {
        type: 'update',
        flag: snapshot.flag,
        revision: 4,
        update: { type: 'entries-deleted', ids: [10] },
      })
    ).toBe(true);
  });

  it('accepts the next revision', () => {
    expect(
      bucketResponseHasRevisionGap(snapshot, {
        type: 'update',
        flag: snapshot.flag,
        revision: 3,
        update: { type: 'entries-deleted', ids: [10] },
      })
    ).toBe(false);
  });

  it('accepts a replacement snapshot at any revision', () => {
    expect(
      bucketResponseHasRevisionGap(snapshot, {
        type: 'snapshot',
        flag: snapshot.flag,
        state: snapshot.state,
      })
    ).toBe(false);
  });
});
