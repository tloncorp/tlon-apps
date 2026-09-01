import type { BucketsDeleteGrant } from '@tloncorp/api';
import { describe, expect, it, vi } from 'vitest';

import { deleteGrantedBucketObjects } from './bucketDeletion';

function grant(entryId: number, object: string): BucketsDeleteGrant {
  return {
    token: `cap-${entryId}`,
    entryId,
    object,
    expiresAt: '~2026.1.1',
  };
}

describe('deleteGrantedBucketObjects', () => {
  it('deletes each object with the grant the host minted for it', async () => {
    const calls: string[] = [];

    await deleteGrantedBucketObjects(
      [grant(1, 'object-1'), grant(2, 'object-2')],
      { host: '~zod', name: 'files' },
      {
        deleteObject: async (capability, host, objectId) => {
          calls.push(`${capability}:${host}:${objectId}`);
        },
        isAlreadyDeleted: () => false,
      }
    );

    expect(calls).toEqual(['cap-1:~zod:object-1', 'cap-2:~zod:object-2']);
  });

  // Losing a race to another deleter is the outcome this wanted, so the rest
  // of the subtree still gets cleaned up.
  it('keeps going when an object was already deleted', async () => {
    const missing = new Error('object was not found');
    const cleared: number[] = [];

    await deleteGrantedBucketObjects(
      [grant(1, 'object-1'), grant(2, 'object-2')],
      { host: '~zod', name: 'files' },
      {
        deleteObject: async (_capability, _host, objectId) => {
          if (objectId === 'object-1') throw missing;
        },
        isAlreadyDeleted: (cause) => cause === missing,
        onObjectDeleted: (entryId) => cleared.push(entryId),
      }
    );

    expect(cleared).toEqual([1, 2]);
  });

  it('stops on a failure that is not an already-deleted object', async () => {
    const refused = new Error('not authorized');

    await expect(
      deleteGrantedBucketObjects(
        [grant(1, 'object-1')],
        { host: '~zod', name: 'files' },
        {
          deleteObject: vi.fn().mockRejectedValue(refused),
          isAlreadyDeleted: () => false,
        }
      )
    ).rejects.toBe(refused);
  });
});
