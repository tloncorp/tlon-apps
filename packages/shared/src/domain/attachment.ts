export type LinkMetadata = PageMetadata | FileMetadata;

export type PageMetadata = {
  url: string;
  type: 'page';
  siteIconUrl?: string;
  siteName?: string;
  title?: string;
  author?: string;
  description?: string;
  previewImageUrl?: string;
};

export type FileMetadata = {
  url: string;
  type: 'file';
  mime: string;
  isImage?: boolean;
};

export type LinkAttachment = {
  type: 'link';
  url: string;
  resourceType?: 'page' | 'file';
  siteIconUrl?: string;
  siteName?: string;
  title?: string;
  author?: string;
  description?: string;
  previewImageUrl?: string;
};
