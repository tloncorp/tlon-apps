import { Attachment } from '@tloncorp/shared';

export const MAX_VIDEO_SIZE_BYTES = 150 * 1024 * 1024;
export const MAX_VIDEO_SIZE_LABEL = '150 MB';
export const VIDEO_COMPOSITION_ERROR =
  'Video posts support one video and optional text only.';
export const VIDEO_SIZE_UNKNOWN_ERROR =
  'We could not read this video. Try downloading it to your device first.';
export const VIDEO_SIZE_LIMIT_ERROR = `Videos must be under ${MAX_VIDEO_SIZE_LABEL}.`;
export const VIDEO_TYPE_ERROR = 'Video posts support MP4, MOV, and WebM files.';
const VIDEO_EXTENSION_TO_MIME = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
} as const;
const VIDEO_MIME_ALLOWLIST: ReadonlySet<string> = new Set(
  Object.values(VIDEO_EXTENSION_TO_MIME)
);
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

export function inferAllowedVideoMimeType({
  mimeType,
  name,
  uri,
}: Pick<VideoCandidate, 'mimeType' | 'name' | 'uri'>): string | undefined {
  if (mimeType) {
    const normalizedMimeType = mimeType.toLowerCase();
    if (VIDEO_MIME_ALLOWLIST.has(normalizedMimeType)) {
      return normalizedMimeType;
    }
  }

  const formatCandidate = (name ?? uri)?.toLowerCase();
  const extension = formatCandidate?.match(VIDEO_EXTENSION_REGEX)?.[1];
  if (!extension) {
    return undefined;
  }
  return VIDEO_EXTENSION_TO_MIME[
    extension as keyof typeof VIDEO_EXTENSION_TO_MIME
  ];
}

export function getVideoValidationError({
  mimeType,
  size,
  name,
  uri,
}: VideoCandidate): string | null {
  if (size == null || size < 0) {
    return VIDEO_SIZE_UNKNOWN_ERROR;
  }
  if (size > MAX_VIDEO_SIZE_BYTES) {
    return VIDEO_SIZE_LIMIT_ERROR;
  }
  if (inferAllowedVideoMimeType({ mimeType, name, uri }) == null) {
    return VIDEO_TYPE_ERROR;
  }
  return null;
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
    const validationError = getVideoValidationError({
      mimeType: nextAttachment.mimeType,
      size: nextAttachment.size,
      name: getVideoName(nextAttachment),
      uri:
        typeof nextAttachment.localFile === 'string'
          ? nextAttachment.localFile
          : undefined,
    });
    if (validationError) {
      return {
        ok: false,
        reason: validationError,
        kind: 'validation',
      };
    }

    if (prev.some((attachment) => attachment.type !== 'video')) {
      return {
        ok: false,
        reason: VIDEO_COMPOSITION_ERROR,
        kind: 'composition',
      };
    }
    return { ok: true };
  }

  if (prev.some((attachment) => attachment.type === 'video')) {
    return {
      ok: false,
      reason: VIDEO_COMPOSITION_ERROR,
      kind: 'composition',
    };
  }

  return { ok: true };
}
