export type LinkMetadata = PageMetadata | FileMetadata;

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
