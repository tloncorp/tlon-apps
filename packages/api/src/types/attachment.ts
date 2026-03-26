import _ from 'lodash';

const { memoize, uniqueId } = _;

import { ContentReference } from './references';
import { UploadState } from './uploads';

export type LinkMetadata = PageMetadata | FileMetadata;

export type LinkMetadataError =
  | { type: 'redirect' }
  | { type: 'error'; reason: 'bad response' | 'unknown error' | string };

export type DefaultPageMetadata = {
  siteIconUrl?: string;
  siteName?: string;
  title?: string;
  author?: string;
  description?: string;
  previewImageUrl?: string;
  previewImageHeight?: string;
  previewImageWidth?: string;
};

export interface PageMetadata extends DefaultPageMetadata {
  url: string;
  type: 'page';
}

export type FileMetadata = {
  url: string;
  type: 'file';
  mime: string;
  isImage?: boolean;
};

export interface LinkAttachment extends DefaultPageMetadata {
  type: 'link';
  url: string;
  resourceType?: 'page' | 'file';
}

export type ReferenceAttachment = {
  type: 'reference';
  reference: ContentReference;
  path: string;
};

export interface ImageAsset {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  mimeType?: string;
}

export type ImageAttachment = {
  type: 'image';
  file: ImageAsset;
  uploadState?: UploadState;
};

export type UploadedImageAttachment = {
  type: 'image';
  file: ImageAsset;
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>;
};

export namespace UploadedImageAttachment {
  export function uri(attachment: UploadedImageAttachment): string {
    switch (attachment.uploadState.status) {
      case 'success':
        return attachment.uploadState.remoteUri;
      case 'uploading':
        return attachment.uploadState.localUri;
    }
  }
}

export type FileAttachment = {
  type: 'file';
  // File or local URI string
  localFile: File | string;
  name?: string;
  /** in bytes */
  size: number;
  mimeType?: string;
};

type VideoAttachmentMetadata = {
  /** in pixels */
  width?: number;
  /** in pixels */
  height?: number;
  /** in seconds */
  duration?: number;
  /** local-only preview URI in v1 */
  posterUri?: string;
};

export type VideoAttachment = {
  type: 'video';
  // File or local URI string
  localFile: File | string;
  name?: string;
  /** in bytes */
  size: number;
  mimeType?: string;
  uploadState?: UploadState;
} & VideoAttachmentMetadata;

export type VoiceMemoAttachment = {
  type: 'voicememo';
  localUri: string;
  /** in bytes */
  size: number;
  /** waveform values to use as a preview */
  waveformPreview?: number[];
  transcription?: string;
  /** in seconds */
  duration?: number;
  mimeType?: string;
};

export type UploadedFileAttachment = {
  type: 'file';
  // File or local URI string
  localFile: File | string;
  name?: string;
  /** in bytes */
  size: number;
  mimeType?: string;
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>;
};

export type UploadedVoiceMemoAttachment = {
  type: 'voicememo';
  localUri: string;
  /** in bytes */
  size: number;
  /** in seconds */
  duration?: number;
  waveformPreview?: number[];
  transcription?: string;
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>;
};

export type UploadedVideoAttachment = Omit<VideoAttachment, 'uploadState'> & {
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>;
};

export namespace UploadedFileAttachment {
  export function uri(attachment: UploadedFileAttachment): string {
    return uploadStateUri(attachment.uploadState);
  }
}

export namespace UploadedVideoAttachment {
  export function uri(attachment: UploadedVideoAttachment): string {
    return uploadStateUri(attachment.uploadState);
  }
}

export type TextAttachment = {
  type: 'text';
  text: string;
};

export type Attachment =
  | ReferenceAttachment
  | ImageAttachment
  | FileAttachment
  | VideoAttachment
  | VoiceMemoAttachment
  | TextAttachment
  | LinkAttachment;

export type FinalizedAttachment =
  | ReferenceAttachment
  | UploadedImageAttachment
  | UploadedFileAttachment
  | UploadedVideoAttachment
  | UploadedVoiceMemoAttachment
  | TextAttachment
  | LinkAttachment;

export namespace Attachment {
  type ImageUploadIntent = {
    type: 'image';
    asset: ImageAsset;
  };
  export type UploadIntent =
    | ImageUploadIntent
    | {
        type: 'fileUri';
        localUri: string;
        name?: string;
        /** in bytes */
        size: number;
        mimeType?: string;
        voiceMemo?:
          | false
          | {
              duration?: number;
              transcription?: string;
              waveformPreview?: number[];
            };
        video?: false | VideoAttachmentMetadata;
      }
    | { type: 'file'; file: File; video?: false | VideoAttachmentMetadata };

  export namespace UploadIntent {
    /** Branded type to avoid using wrong keys downstream */
    export type Key = string & { __brand: 'Attachment.UploadIntent.Key' };

    export function fromImagePickerAsset<T extends ImageAsset>(
      asset: T
    ): UploadIntent {
      return {
        type: 'image',
        asset,
      };
    }

    export function fromFile(
      file: File,
      opts?: { video?: false | VideoAttachmentMetadata }
    ): UploadIntent {
      return { type: 'file', file, video: opts?.video };
    }

    export function createLocalUri(uploadIntent: UploadIntent): string {
      switch (uploadIntent.type) {
        case 'image':
          return uploadIntent.asset.uri;
        case 'file':
          // TODO: URL.revokeObjectURL when no longer needed - shouldn't be
          // an issue unless user uploads a *lot* of files
          return URL.createObjectURL(uploadIntent.file);
        case 'fileUri':
          return uploadIntent.localUri;
      }
    }

    export function getVideoUploadMetadata(
      uploadIntent: UploadIntent
    ): { isVideo: boolean; posterUri?: string } {
      const videoMetadata =
        uploadIntent.type === 'file' || uploadIntent.type === 'fileUri'
          ? uploadIntent.video
          : undefined;
      const posterUri =
        videoMetadata && typeof videoMetadata === 'object'
          ? videoMetadata.posterUri
          : undefined;

      switch (uploadIntent.type) {
        case 'image':
          return { isVideo: false };
        case 'file':
          return {
            isVideo: !!videoMetadata || uploadIntent.file.type.startsWith('video/'),
            posterUri,
          };
        case 'fileUri':
          return {
            isVideo:
              !!videoMetadata ||
              (!!uploadIntent.mimeType &&
                uploadIntent.mimeType.startsWith('video/')),
            posterUri,
          };
      }
    }

    export function extractImagePickerAssets(
      xs: UploadIntent[]
    ): ImageAsset[] {
      return xs
        .filter((x): x is ImageUploadIntent => x.type === 'image')
        .map((x) => x.asset);
    }

    /** Used when keying a 'file'-type UploadIntent. Memoized so that
     * equivalent `File`s yield the same ID. */
    const fileKey = memoize((_file: File): string => uniqueId('File'));

    export function extractKey(uploadIntent: UploadIntent): UploadIntent.Key {
      const rawValue: string = (() => {
        switch (uploadIntent.type) {
          case 'image':
            return uploadIntent.asset.uri;
          case 'file':
            return fileKey(uploadIntent.file);
          case 'fileUri':
            return uploadIntent.localUri;
        }
      })();
      // cast to branded type
      return rawValue as UploadIntent.Key;
    }

    export function equivalent(a: UploadIntent, b: UploadIntent): boolean {
      if (a.type !== b.type) {
        return false;
      }
      switch (a.type) {
        case 'image':
          return a.asset.uri === (b as typeof a).asset.uri;
        case 'file':
          return a.file === (b as typeof a).file;
        case 'fileUri':
          return a.localUri === (b as typeof a).localUri;
      }
    }

    export function toFinalizedAttachment(
      uploadIntent: UploadIntent,
      uploadState: UploadState
    ): FinalizedAttachment | null {
      if (uploadState.status === 'error') {
        return null;
      }
      switch (uploadIntent.type) {
        case 'image':
          return {
            type: 'image',
            file: uploadIntent.asset,
            uploadState,
          };

        case 'file':
          if (uploadIntent.video) {
            return withUploadState(
              videoAttachmentFromFileUploadIntent(uploadIntent),
              uploadState
            );
          }
          return {
            type: 'file',
            localFile: uploadIntent.file,
            size: uploadIntent.file.size,
            mimeType: uploadIntent.file.type,
            name: uploadIntent.file.name,
            uploadState,
          };

        case 'fileUri':
          if (uploadIntent.voiceMemo) {
            return {
              type: 'voicememo',
              localUri: uploadIntent.localUri,
              size: uploadIntent.size,
              duration: uploadIntent.voiceMemo.duration,
              transcription: uploadIntent.voiceMemo.transcription,
              waveformPreview: uploadIntent.voiceMemo.waveformPreview,
              uploadState,
            };
          } else if (uploadIntent.video) {
            return withUploadState(
              videoAttachmentFromFileUriUploadIntent(uploadIntent),
              uploadState
            );
          } else {
            return {
              type: 'file',
              localFile: uploadIntent.localUri,
              name: uploadIntent.name,
              size: uploadIntent.size,
              mimeType: uploadIntent.mimeType,
              uploadState,
            };
          }
      }
    }

    /** Builds a FinalizedAttachment using local data - used in optimistic UI update. */
    export function toLocalFinalizedAttachment(
      uploadIntent: UploadIntent
    ): FinalizedAttachment | null {
      switch (uploadIntent.type) {
        case 'image':
          return {
            type: 'image',
            file: uploadIntent.asset,
            uploadState: {
              status: 'uploading',
              localUri: uploadIntent.asset.uri,
            },
          };

        case 'file':
          if (uploadIntent.video) {
            return withUploadState(
              videoAttachmentFromFileUploadIntent(uploadIntent),
              {
                status: 'uploading',
                localUri: createLocalUri(uploadIntent),
              }
            );
          }
          return {
            type: 'file',
            localFile: uploadIntent.file,
            size: uploadIntent.file.size,
            mimeType: uploadIntent.file.type,
            name: uploadIntent.file.name,
            uploadState: {
              status: 'uploading',
              localUri: createLocalUri(uploadIntent),
            },
          };

        case 'fileUri':
          if (uploadIntent.voiceMemo) {
            return {
              type: 'voicememo',
              localUri: uploadIntent.localUri,
              size: uploadIntent.size,
              duration: uploadIntent.voiceMemo.duration,
              transcription: uploadIntent.voiceMemo.transcription,
              waveformPreview: uploadIntent.voiceMemo.waveformPreview,
              uploadState: {
                status: 'uploading',
                localUri: uploadIntent.localUri,
              },
            };
          } else if (uploadIntent.video) {
            return withUploadState(
              videoAttachmentFromFileUriUploadIntent(uploadIntent),
              {
                status: 'uploading',
                localUri: uploadIntent.localUri,
              }
            );
          } else {
            return {
              type: 'file',
              localFile: uploadIntent.localUri,
              size: uploadIntent.size,
              mimeType: uploadIntent.mimeType,
              name: uploadIntent.name,
              uploadState: {
                status: 'uploading',
                localUri: uploadIntent.localUri,
              },
            };
          }
      }
    }
  }

  export function toUploadIntent(
    attachment: Attachment
  ):
    | { needsUpload: false; finalized: FinalizedAttachment }
    | ({ needsUpload: true } & UploadIntent) {
    switch (attachment.type) {
      case 'image':
        return {
          needsUpload: true,
          type: 'image',
          asset: attachment.file,
        };
      case 'file':
        if (attachment.localFile instanceof File) {
          return {
            needsUpload: true,
            type: 'file',
            file: attachment.localFile,
          };
        } else {
          return {
            needsUpload: true,
            type: 'fileUri',
            localUri: attachment.localFile,
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.mimeType,
          };
        }
      case 'video':
        if (attachment.localFile instanceof File) {
          return {
            needsUpload: true,
            type: 'file',
            file: attachment.localFile,
            video: toVideoMetadata(attachment),
          };
        } else {
          return {
            needsUpload: true,
            type: 'fileUri',
            localUri: attachment.localFile,
            name: attachment.name,
            size: attachment.size,
            mimeType: attachment.mimeType,
            video: toVideoMetadata(attachment),
          };
        }
      case 'voicememo':
        return {
          needsUpload: true,
          type: 'fileUri',
          localUri: attachment.localUri,
          name: attachment.localUri.split('/').pop(), // use filename from URI
          size: attachment.size,
          mimeType: attachment.mimeType,
          voiceMemo: {
            duration: attachment.duration,
            transcription: attachment.transcription,
            waveformPreview: attachment.waveformPreview,
          },
        };
      case 'text':
      // fallthrough
      case 'link':
      // fallthrough
      case 'reference':
        return { needsUpload: false, finalized: attachment };
    }
  }

  export function fromUploadIntent(uploadIntent: UploadIntent): Attachment {
    switch (uploadIntent.type) {
      case 'image': {
        return { type: 'image', file: uploadIntent.asset };
      }
      case 'file': {
        if (uploadIntent.video) {
          return videoAttachmentFromFileUploadIntent(uploadIntent);
        }
        return {
          type: 'file',
          localFile: uploadIntent.file,
          size: uploadIntent.file.size,
          mimeType: uploadIntent.file.type,
        };
      }
      case 'fileUri': {
        if (uploadIntent.voiceMemo) {
          return {
            type: 'voicememo',
            localUri: uploadIntent.localUri,
            size: uploadIntent.size,
            duration: uploadIntent.voiceMemo.duration,
            transcription: uploadIntent.voiceMemo.transcription,
            waveformPreview: uploadIntent.voiceMemo.waveformPreview,
          };
        } else if (uploadIntent.video) {
          return videoAttachmentFromFileUriUploadIntent(uploadIntent);
        } else {
          return {
            type: 'file',
            localFile: uploadIntent.localUri,
            name: uploadIntent.name,
            size: uploadIntent.size,
            mimeType: uploadIntent.mimeType,
          };
        }
      }
    }
  }

  export function toSuccessfulFinalizedAttachment(
    attachment: Attachment,
    uploadState: UploadState | null
  ): FinalizedAttachment | null {
    const uploadIntent = toUploadIntent(attachment);
    if (uploadIntent.needsUpload) {
      if (uploadState == null || uploadState.status !== 'success') {
        return null;
      }
      switch (uploadIntent.type) {
        case 'image':
          return {
            type: 'image',
            file: uploadIntent.asset,
            uploadState,
          };

        case 'file':
          if (uploadIntent.video) {
            return withUploadState(
              videoAttachmentFromFileUploadIntent(uploadIntent),
              uploadState
            );
          }
          return {
            type: 'file',
            localFile: uploadIntent.file,
            size: uploadIntent.file.size,
            name: uploadIntent.file.name,
            mimeType: uploadIntent.file.type,
            uploadState,
          };

        case 'fileUri':
          if (uploadIntent.voiceMemo) {
            return {
              type: 'voicememo',
              localUri: uploadIntent.localUri,
              size: uploadIntent.size,
              duration: uploadIntent.voiceMemo.duration,
              waveformPreview: uploadIntent.voiceMemo.waveformPreview,
              transcription: uploadIntent.voiceMemo.transcription,
              uploadState,
            };
          } else if (uploadIntent.video) {
            return withUploadState(
              videoAttachmentFromFileUriUploadIntent(uploadIntent),
              uploadState
            );
          } else {
            return {
              type: 'file',
              localFile: uploadIntent.localUri,
              size: uploadIntent.size,
              name: uploadIntent.name,
              mimeType: uploadIntent.mimeType,
              uploadState,
            };
          }
      }
    } else {
      return uploadIntent.finalized;
    }
  }

  /**
   * Make an attachment safe for JSON serialization.
   * Converts web File objects to blob URLs.
   * On non-web platforms (React Native), localFile is already a string path.
   */
  export function makeSerializable(att: Attachment): Attachment {
    if (
      (att.type === 'file' || att.type === 'video') &&
      att.localFile instanceof File &&
      typeof URL.createObjectURL === 'function'
    ) {
      return {
        ...att,
        localFile: URL.createObjectURL(att.localFile),
        name: att.localFile.name,
        size: att.localFile.size,
        mimeType: att.localFile.type,
      };
    }
    return att;
  }

  export function isRemoteUri(uri: string): boolean {
    return uri.startsWith('http://') || uri.startsWith('https://');
  }
}

type NonErrorUploadState = Extract<
  UploadState,
  { status: 'success' | 'uploading' }
>;

function toVideoMetadata(
  metadata: VideoAttachmentMetadata
): VideoAttachmentMetadata {
  return {
    width: metadata.width,
    height: metadata.height,
    duration: metadata.duration,
    posterUri: metadata.posterUri,
  };
}

function videoAttachmentFromFileUploadIntent(
  uploadIntent: Extract<Attachment.UploadIntent, { type: 'file' }>
): Omit<VideoAttachment, 'uploadState'> {
  return {
    type: 'video',
    localFile: uploadIntent.file,
    size: uploadIntent.file.size,
    mimeType: uploadIntent.file.type,
    name: uploadIntent.file.name,
    ...toVideoMetadata(uploadIntent.video as VideoAttachmentMetadata),
  };
}

function videoAttachmentFromFileUriUploadIntent(
  uploadIntent: Extract<Attachment.UploadIntent, { type: 'fileUri' }>
): Omit<VideoAttachment, 'uploadState'> {
  return {
    type: 'video',
    localFile: uploadIntent.localUri,
    name: uploadIntent.name,
    size: uploadIntent.size,
    mimeType: uploadIntent.mimeType,
    ...toVideoMetadata(uploadIntent.video as VideoAttachmentMetadata),
  };
}

function withUploadState(
  attachment: Omit<VideoAttachment, 'uploadState'>,
  uploadState: NonErrorUploadState
): UploadedVideoAttachment {
  if (uploadState.status === 'uploading') {
    return {
      ...attachment,
      uploadState,
    };
  }

  const posterUri =
    uploadState.posterUri ??
    (attachment.posterUri && Attachment.isRemoteUri(attachment.posterUri)
      ? attachment.posterUri
      : undefined);
  const { posterUri: _ignoredPosterUri, ...attachmentWithoutPoster } = attachment;

  return {
    ...attachmentWithoutPoster,
    ...(posterUri ? { posterUri } : {}),
    uploadState,
  };
}

export function videoPreviewUri(
  videoAttachment: VideoAttachment
): string | undefined {
  return videoPosterUri(videoAttachment) ?? videoFileUri(videoAttachment);
}

export function videoPosterUri(
  videoAttachment: VideoAttachment
): string | undefined {
  if (videoAttachment.posterUri) {
    return videoAttachment.posterUri;
  }
  if (
    videoAttachment.uploadState?.status === 'success' &&
    videoAttachment.uploadState.posterUri
  ) {
    return videoAttachment.uploadState.posterUri;
  }
  return undefined;
}

export function videoFileUri(
  videoAttachment: VideoAttachment
): string | undefined {
  if (
    videoAttachment.uploadState?.status === 'success' ||
    videoAttachment.uploadState?.status === 'uploading'
  ) {
    return uploadStateUri(videoAttachment.uploadState);
  }
  return typeof videoAttachment.localFile === 'string'
    ? videoAttachment.localFile
    : undefined;
}

export function uploadStateUri(
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>
): string {
  switch (uploadState.status) {
    case 'success':
      return uploadState.remoteUri;
    case 'uploading':
      return uploadState.localUri;
  }
}
