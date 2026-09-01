import type { BucketsDeleteGrant, BucketsFlag } from '@tloncorp/api';

export type BucketObjectDeletionOperations = {
  deleteObject: (
    capability: string,
    host: string,
    objectId: string
  ) => Promise<unknown>;
  isAlreadyDeleted: (cause: unknown) => boolean;
  onObjectDeleted?: (entryId: number) => void;
};

/**
 * Remove the objects a delete unlinked.
 *
 * The grants are the host's own account of what it removed, so this no longer
 * has to guess from a manifest read that may already be stale, and no longer
 * makes a round trip per file to ask for permission. What it cannot do is
 * survive its own process: if this stops partway the remaining objects are
 * left in storage with nothing naming them, which is the orphan sweep's
 * problem rather than something to solve by leaving manifest entries behind.
 *
 * An object another deleter already removed is the outcome this wanted, so it
 * does not stop the rest.
 */
export async function deleteGrantedBucketObjects(
  grants: readonly BucketsDeleteGrant[],
  flag: BucketsFlag,
  operations: BucketObjectDeletionOperations
) {
  for (const grant of grants) {
    try {
      await operations.deleteObject(grant.token, flag.host, grant.object);
    } catch (cause) {
      if (!operations.isAlreadyDeleted(cause)) throw cause;
    }
    operations.onObjectDeleted?.(grant.entryId);
  }
}
