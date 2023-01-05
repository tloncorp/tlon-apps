import { S3Credentials } from '@urbit/api';
import { S3Client } from '@aws-sdk/client-s3';
import { ChatImage } from './chat';

export interface GcpToken {
  accessKey: string;
  expiresIn: number;
}

export interface BaseStorageState {
  loaded?: boolean;
  hasCredentials?: boolean;
  gcp: {
    configured?: boolean;
    token?: GcpToken;
    isConfigured: () => Promise<boolean>;
    getToken: () => Promise<void>;
  };
  s3: {
    configuration: {
      buckets: Set<string>;
      currentBucket: string;
    };
    credentials: S3Credentials | null;
  };
  [ref: string]: unknown;
}

export interface Upload {
  key: string;
  (key: string): {
    file: File;
    status: 'initial' | 'loading' | 'success' | 'error';
    url: string;
    for: string;
    key: string;
  };
}

export interface FileStoreFile {
  file: File;
  status: 'initial' | 'loading' | 'success' | 'error';
  errorMessage?: string;
  url: string;
  for: string;
  key: string;
}

export interface FileStore {
  client: S3Client | null;
  status: 'initial' | 'loading' | 'success' | 'error';
  files: Record<string, FileStoreFile>;
  createClient: (s3: S3Credentials) => void;
  setStatus: (status: string) => void;
  setErrorMessage: (file: Array<number | string>) => void;
  setFiles: (file: Upload) => void;
  setFileStatus: (file: Array<number | string>) => void;
  setFileURL: (file: Array<number | string>) => void;
  clearFiles: () => void;
  removeFileByURL: (i: ChatImage) => void;
}

export interface UploadInputProps {
  multiple?: boolean;
  id: string;
}
