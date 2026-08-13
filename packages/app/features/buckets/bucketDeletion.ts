import type { BucketsFileEntry, BucketsFlag } from '@tloncorp/api';

export type PrivateFileDeletionOperations = {
  createCapability: () => string;
  deleteManifestEntry: (id: number) => Promise<unknown>;
  deleteObject: (
    capability: string,
    host: string,
    objectId: string
  ) => Promise<unknown>;
  isAlreadyDeleted: (cause: unknown) => boolean;
  issueDelete: (capability: string, id: number) => Promise<unknown>;
  onManifestDelete?: (id: number) => void;
};

export async function deletePrivateBucketFiles(
  entries: BucketsFileEntry[],
  flag: BucketsFlag,
  operations: PrivateFileDeletionOperations
) {
  for (const entry of entries) {
    const capability = operations.createCapability();
    await operations.issueDelete(capability, entry.id);
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
