export type BucketPreviewKind =
  | 'image'
  | 'video'
  | 'text'
  | 'pdf'
  | 'unsupported';

export type BucketFileViewerItem = {
  name: string;
  mimeType?: string;
  sizeLabel?: string;
  uri: string;
  textContent?: string;
};

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
