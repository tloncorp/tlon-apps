export interface LinkMetadataResponse {
  result: PageMetadata | FileMetadata | string | null;
  status: number;
  fetched_at: string;
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
  attributes?: Record<string, string>;
}
