import { Attachment } from '@tloncorp/shared';

const MAX_VIDEO_SIZE_BYTES = 200 * 1024 * 1024;
export const VIDEO_COMPOSITION_ERROR =
  'Video posts support one video and optional text only.';
export const VIDEO_VALIDATION_ERROR = 'Unsupported video attachment';
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

export function validateVideoSource(
  { mimeType, size, name, uri }: VideoCandidate
): boolean {
  if (size == null || size < 0) {
    return false;
  }
  if (size > MAX_VIDEO_SIZE_BYTES) {
    return false;
  }
  return inferAllowedVideoMimeType({ mimeType, name, uri }) != null;
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
    if (
      !validateVideoSource({
        mimeType: nextAttachment.mimeType,
        size: nextAttachment.size,
        name,
        uri:
          typeof nextAttachment.localFile === 'string'
            ? nextAttachment.localFile
            : undefined,
      })
    ) {
      return {
        ok: false,
        reason: VIDEO_VALIDATION_ERROR,
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
