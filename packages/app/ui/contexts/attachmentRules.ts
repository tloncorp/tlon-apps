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

type VideoCandidate = {
  mimeType?: string;
  name?: string;
  uri?: string;
  size?: number;
};

type VideoValidationResult = { ok: true } | { ok: false; reason: string };

export function isLikelyVideoSource({
  mimeType,
  name,
  uri,
}: Pick<VideoCandidate, 'mimeType' | 'name' | 'uri'>): boolean {
  return (
    (!!mimeType && mimeType.toLowerCase().startsWith('video/')) ||
    (!!name && VIDEO_EXTENSION_REGEX.test(name)) ||
    (!!uri && VIDEO_EXTENSION_REGEX.test(uri))
  );
}

export function validateVideoSource(
  { mimeType, size, name, uri }: VideoCandidate
): VideoValidationResult {
  if (size == null || size < 0) {
    return {
      ok: false,
      reason: 'Unable to determine video size',
    };
  }
  if (size != null && size > MAX_VIDEO_SIZE_BYTES) {
    return {
      ok: false,
      reason: 'Video exceeds the 100MB upload limit',
    };
  }
  if (mimeType) {
    const normalizedMimeType = mimeType.toLowerCase();
    if (!VIDEO_MIME_ALLOWLIST.has(normalizedMimeType)) {
      return {
        ok: false,
        reason: `Unsupported video format: ${normalizedMimeType}`,
      };
    }
    return { ok: true };
  }
  const formatCandidate = name ?? uri;
  if (!formatCandidate || !VIDEO_EXTENSION_REGEX.test(formatCandidate)) {
    return {
      ok: false,
      reason: 'Unsupported video format',
    };
  }
  return { ok: true };
}

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
    const name = getVideoName(nextAttachment);
    const validation = validateVideoSource(
      {
        mimeType: nextAttachment.mimeType,
        size: nextAttachment.size,
        name,
        uri:
          typeof nextAttachment.localFile === 'string'
            ? nextAttachment.localFile
            : undefined,
      }
    );
    if (!validation.ok) {
      return {
        ok: false,
        reason: validation.reason,
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
