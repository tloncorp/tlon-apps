import type { BucketsFileEntry, BucketsFlag } from '@tloncorp/api';

export type PrivateFileDeletionOperations = {
  deleteManifestEntry: (id: number) => Promise<unknown>;
  deleteObject: (
    capability: string,
    host: string,
    objectId: string
  ) => Promise<unknown>;
  isAlreadyDeleted: (cause: unknown) => boolean;
  /** Whether a failed manifest delete means the entry is already gone. */
  isMissingEntry: (cause: unknown) => boolean;
  /** Asks the host for a delete grant and returns its bearer token. */
  issueDelete: (id: number) => Promise<string>;
  onManifestDelete?: (id: number) => void;
};

export async function deletePrivateBucketFiles(
  entries: BucketsFileEntry[],
  flag: BucketsFlag,
  operations: PrivateFileDeletionOperations
) {
  for (const entry of entries) {
    const capability = await operations.issueDelete(entry.id);
    try {
      await operations.deleteObject(
        capability,
        flag.host,
        entry.file.objectKey
      );
    } catch (cause) {
      if (!operations.isAlreadyDeleted(cause)) throw cause;
    }
    try {
      await operations.deleteManifestEntry(entry.id);
    } catch (cause) {
      // Two collaborators deleting the same file each get a grant. One wins
      // the object delete and the other is told it was already gone, which
      // this loop accepts -- but both then delete the manifest entry, and the
      // loser is told there is nothing there. That is the outcome it asked
      // for; treating it as a failure aborted the rest of a recursive folder
      // delete and reported a deleted file as undeleted.
      if (!operations.isMissingEntry(cause)) throw cause;
    }
    operations.onManifestDelete?.(entry.id);
  }
}
