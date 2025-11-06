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

export type TextAttachment = {
  type: 'text';
  text: string;
};

export type Attachment =
  | ReferenceAttachment
  | ImageAttachment
  | TextAttachment
  | LinkAttachment;

export type FinalizedAttachment =
  | ReferenceAttachment
  | UploadedImageAttachment
  | TextAttachment
  | LinkAttachment;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Attachment {
  export type UploadIntent =
    | { type: 'image'; asset: ImagePickerAsset }
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

    /** Used when keying a 'file'-type UploadIntent. Memoized so that
     * equivalent `File`s yield the same ID. */
    const fileKey = memoize((file: File): string => uniqueId('File'));

    export function extractKey(uploadIntent: UploadIntent): UploadIntent.Key {
      const rawValue: string = (() => {
        switch (uploadIntent.type) {
          case 'image':
            return uploadIntent.asset.uri;
          case 'file':
            return fileKey(uploadIntent.file);
        }
      })();
      // cast to branded type
      return rawValue as UploadIntent.Key;
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
        // TODO
        throw new Error('File attachments are not implemented.');
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
          // TODO
          throw new Error('File attachments are not implemented.');
      }
    } else {
      return uploadIntent.finalized;
    }
  }
}
