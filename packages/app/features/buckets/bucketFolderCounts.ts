import type { BucketsEntry } from '@tloncorp/api';
import type { BucketCounts } from '@tloncorp/shared/db';

/**
 * What each folder holds, counted through every level beneath it -- the way
 * a notebook's folders count notes -- so a folder row reads the same as the
 * Bucket's own summary. As there, a file counts only once it has finished
 * uploading (see getBucketCountsByChannel).
 *
 * Linear in the manifest: each folder is summed once from its children's
 * totals, rather than every entry walking its whole ancestor chain, which a
 * deeply nested Bucket would make quadratic during render.
 */
export function buildBucketFolderCounts(
  entries: readonly BucketsEntry[]
): Map<number, BucketCounts> {
  const counts = new Map<number, BucketCounts>();
  for (const entry of entries) {
    if (entry.kind === 'folder') {
      counts.set(entry.id, { fileCount: 0, folderCount: 0 });
    }
  }
  const childrenByFolder = new Map<number, BucketsEntry[]>();
  for (const entry of entries) {
    if (entry.parentId === null || !counts.has(entry.parentId)) continue;
    const siblings = childrenByFolder.get(entry.parentId);
    if (siblings) {
      siblings.push(entry);
    } else {
      childrenByFolder.set(entry.parentId, [entry]);
    }
  }

  // Postorder, kept on an explicit stack so a long chain of folders can't
  // overflow the call stack. A folder reached again while it is still open
  // is a loop in the manifest; that edge is dropped, so the walk ends.
  const state = new Map<number, 'open' | 'done'>();
  for (const start of counts.keys()) {
    if (state.has(start)) continue;
    state.set(start, 'open');
    const stack = [{ folderId: start, next: 0 }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const children = childrenByFolder.get(frame.folderId) ?? [];
      if (frame.next < children.length) {
        const child = children[frame.next++];
        if (child.kind === 'folder' && !state.has(child.id)) {
          state.set(child.id, 'open');
          stack.push({ folderId: child.id, next: 0 });
        }
        continue;
      }

      const total = counts.get(frame.folderId)!;
      for (const child of children) {
        if (child.kind === 'file') {
          if (child.file.status === 'ready') total.fileCount += 1;
        } else if (state.get(child.id) === 'done') {
          const childTotal = counts.get(child.id)!;
          total.fileCount += childTotal.fileCount;
          total.folderCount += 1 + childTotal.folderCount;
        }
      }
      state.set(frame.folderId, 'done');
      stack.pop();
    }
  }

  return counts;
}
