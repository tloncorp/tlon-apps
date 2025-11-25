import { ImagePickerAsset } from 'expo-image-picker';
import { memoize, uniqueId } from 'lodash';

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

export type ImageAttachment = {
  type: 'image';
  file: ImagePickerAsset;
  uploadState?: UploadState;
};

export type UploadedImageAttachment = {
  type: 'image';
  file: ImagePickerAsset;
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>;
};

// eslint-disable-next-line @typescript-eslint/no-namespace
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
};

export type UploadedFileAttachment = {
  type: 'file';
  // File or local URI string
  localFile: File | string;
  name?: string;
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>;
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace UploadedFileAttachment {
  export function uri(attachment: UploadedFileAttachment): string {
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
  | TextAttachment
  | LinkAttachment;

export type FinalizedAttachment =
  | ReferenceAttachment
  | UploadedImageAttachment
  | UploadedFileAttachment
  | TextAttachment
  | LinkAttachment;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Attachment {
  type ImageUploadIntent = {
    type: 'image';
    asset: Pick<
      ImagePickerAsset,
      'uri' | 'width' | 'height' | 'fileSize' | 'mimeType'
    >;
  };
  export type UploadIntent =
    | ImageUploadIntent
    | { type: 'fileUri'; localUri: string; name?: string }
    | { type: 'file'; file: File };

  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace UploadIntent {
    /** Branded type to avoid using wrong keys downstream */
    export type Key = string & { __brand: 'Attachment.UploadIntent.Key' };

    export function fromImagePickerAsset(
      asset: ImagePickerAsset
    ): UploadIntent {
      return {
        type: 'image',
        asset,
      };
    }

    export function fromFile(file: File): UploadIntent {
      return { type: 'file', file };
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

    export function extractImagePickerAssets(
      xs: UploadIntent[]
    ): ImagePickerAsset[] {
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
          return {
            type: 'file',
            localFile: uploadIntent.file,
            uploadState,
          };

        case 'fileUri':
          return {
            type: 'file',
            localFile: uploadIntent.localUri,
            name: uploadIntent.name,
            uploadState,
          };
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
          return {
            type: 'file',
            localFile: uploadIntent.file,
            uploadState: {
              status: 'uploading',
              localUri: createLocalUri(uploadIntent),
            },
          };

        case 'fileUri':
          return {
            type: 'file',
            localFile: uploadIntent.localUri,
            name: uploadIntent.name,
            uploadState: {
              status: 'uploading',
              localUri: uploadIntent.localUri,
            },
          };
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
          };
        }
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
        return { type: 'file', localFile: uploadIntent.file };
      }
      case 'fileUri': {
        return {
          type: 'file',
          localFile: uploadIntent.localUri,
          name: uploadIntent.name,
        };
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
          return {
            type: 'file',
            localFile: uploadIntent.file,
            uploadState,
          };

        case 'fileUri':
          return {
            type: 'file',
            localFile: uploadIntent.localUri,
            uploadState,
          };
      }
    } else {
      return uploadIntent.finalized;
    }
  }
}

function uploadStateUri(
  uploadState: Extract<UploadState, { status: 'success' | 'uploading' }>
): string {
  switch (uploadState.status) {
    case 'success':
      return uploadState.remoteUri;
    case 'uploading':
      return uploadState.localUri;
  }
}
