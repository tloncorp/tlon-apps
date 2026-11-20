import type { BucketsEntry } from '@tloncorp/api';

export function getBucketPreviewFiles(
  entries: BucketsEntry[],
  entryId: number
) {
  const selected = entries.find((entry) => entry.id === entryId);
  if (selected?.kind !== 'file') return [];
  return entries
    .filter(
      (entry) =>
        entry.kind === 'file' &&
        entry.file.status === 'ready' &&
        entry.parentId === selected.parentId
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}
