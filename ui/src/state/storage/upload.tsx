import { S3Credentials } from '@urbit/api';
import { S3Client } from '@aws-sdk/client-s3';
import create from 'zustand';
import produce from 'immer';
import { FileStore } from '@/types/storage';

export function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}

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
  setFileURL: (file) =>
    set(
      produce((draft) => {
        const [idx, url] = file;
        draft.files[idx].url = url;
      })
    ),
}));
