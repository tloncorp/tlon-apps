import type { BucketsSnapshot } from '@tloncorp/api';
import { describe, expect, it } from 'vitest';

import { findUploadShadowEntryIds } from './bucketUploadReconciliation';

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
