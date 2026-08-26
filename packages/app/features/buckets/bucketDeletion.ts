import type { BucketsFileEntry, BucketsFlag } from '@tloncorp/api';

export type PrivateFileDeletionOperations = {
  deleteManifestEntry: (id: number) => Promise<unknown>;
  deleteObject: (
    capability: string,
    host: string,
    objectId: string
  ) => Promise<unknown>;
  isAlreadyDeleted: (cause: unknown) => boolean;
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
    await operations.deleteManifestEntry(entry.id);
    operations.onManifestDelete?.(entry.id);
  }
}
