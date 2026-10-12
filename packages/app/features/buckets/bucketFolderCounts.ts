import type { BucketsEntry } from '@tloncorp/api';
import type { BucketCounts } from '@tloncorp/shared/db';

/**
 * What each folder holds, counted through every level beneath it -- the way
 * a notebook's folders count notes -- so a folder row reads the same as the
 * Bucket's own summary. As there, a file counts only once it has finished
 * uploading (see getBucketCountsByChannel).
 */
export function buildBucketFolderCounts(
  entries: readonly BucketsEntry[]
): Map<number, BucketCounts> {
  const counts = new Map<number, BucketCounts>();
  const parentByFolderId = new Map<number, number | null>();
  for (const entry of entries) {
    if (entry.kind === 'folder') {
      counts.set(entry.id, { fileCount: 0, folderCount: 0 });
      parentByFolderId.set(entry.id, entry.parentId);
    }
  }

  for (const entry of entries) {
    const field =
      entry.kind === 'folder'
        ? 'folderCount'
        : entry.file.status === 'ready'
          ? 'fileCount'
          : null;
    if (!field) continue;
    // A manifest that loops back on itself would otherwise never end, and
    // a folder on the loop would count itself.
    const visited = new Set<number>([entry.id]);
    let folderId = entry.parentId;
    while (folderId !== null && !visited.has(folderId)) {
      const folderCounts = counts.get(folderId);
      if (!folderCounts) break;
      visited.add(folderId);
      folderCounts[field] += 1;
      folderId = parentByFolderId.get(folderId) ?? null;
    }
  }

  return counts;
}
