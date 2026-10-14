/**
 * One-line summary of what a foldered channel holds, for places that have no
 * post to preview: "25 notes in 4 folders", "3 files", "No files in 2
 * folders". `noun` is singular.
 */
export function formatChannelContentsSummary({
  count,
  noun,
  folderCount,
}: {
  count: number;
  noun: string;
  folderCount: number;
}): string {
  const items = count === 0 ? `No ${noun}s` : countOf(count, noun);
  return folderCount === 0
    ? items
    : `${items} in ${countOf(folderCount, 'folder')}`;
}

/**
 * Summary of a Bucket, or of one folder in it. Counts only files that have
 * finished uploading -- see getBucketCountsByChannel.
 */
export function formatBucketContents({
  fileCount,
  folderCount,
}: {
  fileCount: number;
  folderCount: number;
}): string {
  return formatChannelContentsSummary({
    count: fileCount,
    noun: 'file',
    folderCount,
  });
}

function countOf(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
