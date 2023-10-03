import { S3Credentials } from '@urbit/api';
import { S3Client } from '@aws-sdk/client-s3';
import { Status } from '@/logic/status';

export interface GcpToken {
  accessKey: string;
  expiresIn: number;
}

export interface StorageCredentialsTlonHosting {
  endpoint: string;
  token: string;
}

export type StorageBackend = 's3' | 'tlon-hosting';

export interface BaseStorageState {
  loaded?: boolean;
  hasCredentials?: boolean;
  backend: StorageBackend;
  s3: {
    configuration: {
      buckets: Set<string>;
      currentBucket: string;
      region: string;
    };
    credentials: S3Credentials | null;
  };
  tlonHosting: StorageCredentialsTlonHosting;
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
  uploadFiles: (files: FileList | File[] | null) => Promise<void>;
  removeByURL: (url: string) => void;
  clear: () => void;
  prompt: () => void;
  uploadType: 'prompt' | 'paste' | 'drag';
}

export interface FileStore {
  // Only one among S3 client or Tlon credentials will be set at a given time.
  s3Client: S3Client | null;
  tlonHostingCredentials: StorageCredentialsTlonHosting | null;
  uploaders: Record<string, Uploader>;
  getUploader: (key: string) => Uploader;
  createS3Client: (s3: S3Credentials, region: string) => void;
  setTlonHostingCredentials: (
    credentials: StorageCredentialsTlonHosting
  ) => void;
  update: (key: string, updateFn: (uploader: Uploader) => void) => void;
  uploadFiles: (
    uploader: string,
    files: FileList | File[] | null,
    bucket: string
  ) => Promise<void>;
  upload: (uploader: string, upload: Upload, bucket: string) => Promise<void>;
  clear: (uploader: string) => void;
  setUploadType: (uploaderKey: string, type: Uploader['uploadType']) => void;
  getUploadType: (uploaderKey: string) => Uploader['uploadType'];
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
