import React from 'react';
import { S3Client } from '@aws-sdk/client-s3';
import { S3Credentials, S3Configuration } from '@urbit/api';
import create from 'zustand';
import produce from 'immer';

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

export function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}

export const useS3Creds = create<S3Credentials>(() => ({
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: '',
}));

export const useS3Config = create<S3Configuration>(() => ({
  buckets: new Set(['']),
  currentBucket: '',
}));

export const useFileStore = create<FileStore>((set) => ({
  client: null,
  status: 'initial',
  files: [],
  createClient: (credentials: S3Credentials) => {
    const endpoint = new URL(prefixEndpoint(credentials.endpoint));
    const client = new S3Client({
      endpoint: {
        protocol: endpoint.protocol.slice(0, -1),
        hostname: endpoint.host,
        path: endpoint.pathname || '/',
      },
      region: 'global',
      credentials,
      forcePathStyle: true,
    });
    set({ client });
  },
  setStatus: (status) =>
    set(
      produce((draft) => {
        draft.status = status;
      })
    ),
  setFiles: (files) =>
    set(
      produce((draft) => {
        draft.files = files;
      })
    ),
  setFileStatus: (file) =>
    set(
      produce((draft) => {
        const [idx, status] = file;
        draft.files[idx].status = status;
      })
    ),
}));
