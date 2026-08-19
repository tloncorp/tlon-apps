import type { BucketsFileEntry } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import { deletePrivateBucketFiles } from './bucketDeletion';

function file(id: number, objectKey: string): BucketsFileEntry {
  return {
    createdAt: 1,
    createdBy: '~zod',
    file: {
      checksum: null,
      mime: 'text/plain',
      objectKey,
      size: 10,
      status: 'ready',
    },
    id,
    kind: 'file',
    name: `${id}.txt`,
    parentId: null,
    updatedAt: 1,
    updatedBy: '~zod',
  };
}

describe('deletePrivateBucketFiles', () => {
  it('removes each manifest entry before deleting the next object', async () => {
    const calls: string[] = [];
    const secondFailure = new Error('second object failed');

    await expect(
      deletePrivateBucketFiles(
        [file(1, 'object-1'), file(2, 'object-2')],
        { host: '~zod', name: 'files' },
        {
          issueDelete: async (id) => {
            calls.push(`issue:${id}`);
            return `cap-${id}`;
          },
          deleteObject: async (_capability, _host, objectId) => {
            calls.push(`object:${objectId}`);
            if (objectId === 'object-2') throw secondFailure;
          },
          deleteManifestEntry: async (id) => {
            calls.push(`manifest:${id}`);
          },
          isAlreadyDeleted: () => false,
        }
      )
    ).rejects.toBe(secondFailure);

    expect(calls).toEqual([
      'issue:1',
      'object:object-1',
      'manifest:1',
      'issue:2',
      'object:object-2',
    ]);
  });

  it('continues manifest cleanup when the object was already deleted', async () => {
    const deleteManifestEntry = vi.fn().mockResolvedValue(undefined);
    const missingObject = new Error('object was not found');

    await deletePrivateBucketFiles(
      [file(1, 'object-1')],
      { host: '~zod', name: 'files' },
      {
        issueDelete: vi.fn().mockResolvedValue('cap-1'),
        deleteObject: vi.fn().mockRejectedValue(missingObject),
        deleteManifestEntry,
        isAlreadyDeleted: (cause) => cause === missingObject,
      }
    );

    expect(deleteManifestEntry).toHaveBeenCalledWith(1);
  });
});
