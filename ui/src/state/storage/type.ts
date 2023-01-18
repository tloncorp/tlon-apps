import { S3Credentials } from '@urbit/api';
import { S3Client } from '@aws-sdk/client-s3';
import { Status } from '@/logic/status';

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
      region: string;
    };
    credentials: S3Credentials | null;
  };
  [ref: string]: unknown;
}

export interface FileStoreFile {
  key: string;
  file: File;
  url: string;
  size: [number, number];
}

export interface Upload extends FileStoreFile {
  status: Status;
  errorMessage?: string;
}

interface UpdateStatus {
  (uploader: string, key: string, status: 'error', msg: string): void;
  (
    uploader: string,
    key: string,
    status: Omit<Status, 'error'>,
    msg?: string
  ): void;
}

export interface Uploader {
  files: Record<string, Upload>;
  getMostRecent: () => Upload | null;
  uploadFiles: (files: FileList | null) => Promise<void>;
  removeByURL: (url: string) => void;
  clear: () => void;
  prompt: () => void;
}

export interface FileStore {
  client: S3Client | null;
  uploaders: Record<string, Uploader>;
  createClient: (s3: S3Credentials, region: string) => void;
  update: (key: string, updateFn: (uploader: Uploader) => void) => void;
  uploadFiles: (
    uploader: string,
    files: FileList | null,
    bucket: string
  ) => Promise<void>;
  upload: (uploader: string, upload: Upload, bucket: string) => Promise<void>;
  clear: (uploader: string) => void;
  updateFile: (
    uploader: string,
    key: string,
    file: Partial<FileStoreFile>
  ) => void;
  updateStatus: UpdateStatus;
  removeByURL: (uploader: string, url: string) => void;
  getMostRecent: (uploader: string) => Upload | null;
}

export interface UploadInputProps {
  multiple?: boolean;
  id: string;
}
