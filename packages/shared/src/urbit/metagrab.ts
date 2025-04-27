export interface LinkMetadataResponse {
  result?: PageMetadata | FileMetadata;
}

interface PageMetadata {
  type: 'page';
  site_icon?: LinkMetadataItem[];
  site_name?: LinkMetadataItem[];
  title?: LinkMetadataItem[];
  description?: LinkMetadataItem[];
  status?: number;
  image?: LinkMetadataItem[];
}

interface FileMetadata {
  type: 'file';
  mime: string;
}

export interface LinkMetadataItem {
  key: string;
  namespace: string;
  value: string;
}
