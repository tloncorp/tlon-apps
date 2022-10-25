import { S3Credentials } from '@urbit/api';
import { S3Client } from '@aws-sdk/client-s3';

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
  file: File;
  status: 'initial' | 'loading' | 'success' | 'error';
}

export interface FileStore {
  client: S3Client | null;
  status: 'initial' | 'loading' | 'success' | 'error';
  files: Array<Upload>;
  createClient: (s3: S3Credentials) => void;
  setStatus: (status: string) => void;
  setFiles: (files: object) => void;
  setFileStatus: (file: Array<number | string>) => void;
}

export interface UploadInputProps {
  multiple?: boolean;
}
