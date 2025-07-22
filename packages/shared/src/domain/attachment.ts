import { ImagePickerAsset } from 'expo-image-picker';

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
