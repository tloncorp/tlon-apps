import { Attachment } from '@tloncorp/shared';

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const VIDEO_COMPOSITION_ERROR =
  'Video posts support one video and optional text only.';
const VIDEO_MIME_ALLOWLIST = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const VIDEO_EXTENSION_REGEX = /\.(mp4|mov|webm)(?:\?.*)?$/i;

export type AttachmentValidationResult =
  | { ok: true }
  | { ok: false; reason: string; kind: 'composition' | 'validation' };

function getVideoName(video: Extract<Attachment, { type: 'video' }>): string {
  if (video.name) {
    return video.name;
  }
  const localFile = video.localFile;
  if (
    typeof File !== 'undefined' &&
    localFile instanceof File &&
    localFile.name
  ) {
    return localFile.name;
  }
  return typeof localFile === 'string' ? localFile : '';
}

export function canAddAttachment(
  prev: Attachment[],
  nextAttachment: Attachment
): AttachmentValidationResult {
  if (nextAttachment.type === 'video') {
    const mimeType = nextAttachment.mimeType?.toLowerCase();
    const localUri =
      typeof nextAttachment.localFile === 'string'
        ? nextAttachment.localFile
        : null;
    const isRemoteUri =
      localUri != null &&
      (localUri.startsWith('http://') || localUri.startsWith('https://'));
    const name = getVideoName(nextAttachment);

    if (nextAttachment.size < 0 && !isRemoteUri) {
      return {
        ok: false,
        reason: 'Unable to determine video size',
        kind: 'validation',
      };
    }
    if (nextAttachment.size > MAX_VIDEO_SIZE_BYTES) {
      return {
        ok: false,
        reason: 'Video exceeds the 100MB upload limit',
        kind: 'validation',
      };
    }
    if (mimeType && !VIDEO_MIME_ALLOWLIST.has(mimeType)) {
      return {
        ok: false,
        reason: `Unsupported video format: ${mimeType}`,
        kind: 'validation',
      };
    }
    if (!mimeType && !VIDEO_EXTENSION_REGEX.test(name)) {
      return {
        ok: false,
        reason: 'Unsupported video format',
        kind: 'validation',
      };
    }
  }

  if (nextAttachment.type === 'text') {
    return { ok: true };
  }

  const hasVideo = prev.some((attachment) => attachment.type === 'video');
  const hasOtherNonTextMedia = prev.some(
    (attachment) =>
      attachment.type !== 'text' && attachment.type !== 'video'
  );

  if (nextAttachment.type === 'video') {
    if (hasOtherNonTextMedia) {
      return {
        ok: false,
        reason: VIDEO_COMPOSITION_ERROR,
        kind: 'composition',
      };
    }
    return { ok: true };
  }

  if (hasVideo) {
    return {
      ok: false,
      reason: VIDEO_COMPOSITION_ERROR,
      kind: 'composition',
    };
  }

  return { ok: true };
}
