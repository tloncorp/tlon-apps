import _ from 'lodash';
import create from 'zustand';
import produce from 'immer';
import { dateToDa, deSig, s3, S3Credentials } from '@urbit/api';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getImageSize } from 'react-image-size';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Status } from '@/logic/status';
import { FileStore, Uploader } from './type';
import { useStorage } from './storage';
import { StorageState } from './reducer';

export function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}

function imageSize(url: string) {
  const size = getImageSize(url).then<[number, number]>(({ width, height }) => [
    width,
    height,
  ]);
  return size;
}

export const useFileStore = create<FileStore>((set, get) => ({
  client: null,
  uploaders: {},
  createClient: (credentials: S3Credentials, region: string) => {
    const endpoint = new URL(prefixEndpoint(credentials.endpoint));
    const client = new S3Client({
      endpoint: {
        protocol: endpoint.protocol.slice(0, -1),
        hostname: endpoint.host,
        path: endpoint.pathname || '/',
      },
      // us-east-1 is necessary for compatibility with other S3 providers (i.e., filebase)
      region: region || 'us-east-1',
      credentials,
      forcePathStyle: true,
    });
    set({ client });
  },
  update: (key: string, updateFn: (uploader: Uploader) => void) => {
    set(produce((draft) => updateFn(draft.uploaders[key])));
  },
  uploadFiles: async (uploader, files, bucket) => {
    if (!files) return;

    const fileList = [...files].map((file) => ({
      file,
      key: `${window.ship}/${deSig(dateToDa(new Date()))}-${file.name}`,
      status: 'initial' as Status,
      url: '',
      size: [0, 0] as [number, number],
    }));

    const newFiles = _.keyBy(fileList, 'key');

    const { update, upload } = get();

    update(uploader, (draft) => {
      draft.files = { ...draft.files, ...newFiles };
    });

    fileList.forEach((f) => upload(uploader, f, bucket));
  },
  upload: async (uploader, upload, bucket) => {
    const { client, updateStatus, updateFile } = get();
    if (!client) {
      return;
    }

    const { key, file } = upload;
    updateStatus(uploader, key, 'loading');

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: file.type,
      ContentLength: file.size,
      ACL: 'public-read',
    });

    const url = await getSignedUrl(client, command);

    client
      .send(command)
      .then(() => {
        const fileUrl = url.split('?')[0];
        updateStatus(uploader, key, 'success');
        imageSize(fileUrl).then((s) =>
          updateFile(uploader, key, {
            size: s,
            url: fileUrl,
          })
        );
      })
      .catch((error: any) => {
        updateStatus(
          uploader,
          key,
          'error',
          `S3 upload error: ${error.message}, check your S3 configuration.`
        );
        console.log({ error });
      });
  },
  clear: (uploader) => {
    get().update(uploader, (draft) => {
      draft.files = {};
    });
  },
  updateFile: (uploader, fileKey, file) => {
    get().update(uploader, (draft) => {
      const current = draft.files[fileKey];
      draft.files[fileKey] = { ...current, ...file };
    });
  },
  updateStatus: (uploader, fileKey, status, msg) => {
    get().update(uploader, (draft) => {
      draft.files[fileKey].status = status as Status;

      if (status === 'error' && msg) {
        draft.files[fileKey].errorMessage = msg;
      }
    });
  },
  removeByURL: (uploader, url) => {
    get().update(uploader, (draft) => {
      const { files } = draft;
      draft.files = Object.fromEntries(
        Object.entries(files).filter(([_k, f]) => f.url !== url)
      );
    });
  },
  getMostRecent: (key) => {
    const uploader = get().uploaders[key];

    if (!uploader) {
      return null;
    }

    const fileKey = _.last(Object.keys(uploader.files).sort());
    return fileKey ? uploader.files[fileKey] : null;
  },
}));

const emptyUploader = (key: string, bucket: string): Uploader => ({
  files: {},
  getMostRecent: () => useFileStore.getState().getMostRecent(key),
  uploadFiles: async (files) =>
    useFileStore.getState().uploadFiles(key, files, bucket),
  clear: () => useFileStore.getState().clear(key),
  removeByURL: (url) => useFileStore.getState().removeByURL(key, url),
  prompt: () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.id = key + Math.floor(Math.random() * 1000000);
    input.accept = 'image/*,video/*,audio/*';
    input.addEventListener('change', async (e) => {
      const { files } = e.target as HTMLInputElement;
      useFileStore.getState().uploadFiles(key, files, bucket);
      input.remove();
    });
    input.click();
  },
});

export function useClient() {
  const {
    s3: { credentials, configuration },
  } = useStorage();
  const { client, createClient } = useFileStore();
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    const hasCreds =
      credentials?.accessKeyId &&
      credentials?.endpoint &&
      credentials?.secretAccessKey;
    if (hasCreds) {
      setHasCredentials(true);
    }
  }, [credentials]);

  const initClient = useCallback(async () => {
    if (credentials) {
      await createClient(credentials, configuration.region);
    }
  }, [createClient, credentials, configuration]);

  useEffect(() => {
    if (hasCredentials && !client) {
      initClient();
    }
  }, [client, hasCredentials, initClient]);

  return client;
}

const selS3 = (s: StorageState) => s.s3;
const selUploader = (key: string) => (s: FileStore) => s.uploaders[key];
export function useUploader(key: string): Uploader | undefined {
  const {
    configuration: { currentBucket },
  } = useStorage(selS3);
  const client = useClient();
  const uploader = useFileStore(selUploader(key));

  useEffect(() => {
    if (client && currentBucket) {
      useFileStore.setState(
        produce((draft) => {
          draft.uploaders[key] = emptyUploader(key, currentBucket);
        })
      );
    }
  }, [client, currentBucket, key]);

  return uploader;
}
