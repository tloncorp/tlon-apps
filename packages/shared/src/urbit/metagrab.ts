export interface LinkMetadataResponse {
  result?: PageMetadata;
}

interface PageMetadata {
  site_icon?: MetadataItem[];
  site_name?: MetadataItem[];
  title?: MetadataItem[];
  type: 'page';
  status?: number;
  image?: MetadataItem[];
}

interface MetadataItem {
  key: string;
  namespace: string;
  value: string;
}
