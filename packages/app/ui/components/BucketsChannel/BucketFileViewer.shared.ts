export type BucketPreviewKind =
  | 'image'
  | 'video'
  | 'text'
  | 'pdf'
  | 'unsupported';

export type BucketFileViewerItem = {
  name: string;
  mimeType?: string;
  size?: number;
  sizeLabel?: string;
  uri?: string;
  textContent?: string;
};

/**
 * Largest object we will read into memory to preview as text.
 *
 * A text preview is `response.text()`, so the whole object becomes a JS
 * string — at roughly twice its byte size in UTF-16, before rendering it.
 * The backend accepts objects up to 5 GiB and a file counts as text on its
 * extension alone, so a log or a database dump named `.csv` is an ordinary
 * thing to find in a Bucket and an unbounded read of one takes the client
 * down. Two megabytes is already tens of thousands of lines, well past what
 * anyone reads in a preview pane.
 */
export const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

/**
 * Whether this file can be previewed as text, or is only too large to be.
 *
 * Refused rather than truncated: a partial JSON or CSV looks like a whole
 * one, and a preview that silently lies is worse than one that declines.
 */
export function canPreviewAsText(
  item: Pick<BucketFileViewerItem, 'mimeType' | 'name' | 'size'>
): boolean {
  if (getBucketPreviewKind(item) !== 'text') return false;
  return item.size === undefined || item.size <= MAX_TEXT_PREVIEW_BYTES;
}

export function getBucketPreviewKind({
  mimeType,
  name,
}: Pick<BucketFileViewerItem, 'mimeType' | 'name'>): BucketPreviewKind {
  const normalizedMimeType = mimeType?.toLowerCase() ?? '';
  const extension = name.split('.').pop()?.toLowerCase();

  if (normalizedMimeType.startsWith('image/')) {
    return 'image';
  }
  if (normalizedMimeType.startsWith('video/')) {
    return 'video';
  }
  if (
    normalizedMimeType.startsWith('text/') ||
    ['md', 'markdown', 'txt', 'json', 'csv'].includes(extension ?? '')
  ) {
    return 'text';
  }
  if (normalizedMimeType === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }

  return 'unsupported';
}
