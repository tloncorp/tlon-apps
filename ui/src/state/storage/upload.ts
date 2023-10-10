import _ from 'lodash';
import create from 'zustand';
import produce from 'immer';
import { dateToDa, deSig, S3Credentials } from '@urbit/api';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getImageSize } from 'react-image-size';
import { useCallback, useEffect, useState } from 'react';
import { Status } from '@/logic/status';
import { FileStore, StorageCredentialsTlonHosting, Uploader } from './type';
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
  s3Client: null,
  tlonHostingCredentials: null,
  uploaders: {},
  createS3Client: (credentials: S3Credentials, region: string) => {
    const endpoint = new URL(prefixEndpoint(credentials.endpoint));
    const s3Client = new S3Client({
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
    set({ s3Client, tlonHostingCredentials: null });
  },
  setTlonHostingCredentials: (credentials: StorageCredentialsTlonHosting) => {
    set({ s3Client: null, tlonHostingCredentials: credentials });
  },
  getUploader: (key) => {
    const { uploaders } = get();

    return uploaders[key];
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
  setUploadType: (uploaderKey, type) => {
    get().update(uploaderKey, (draft) => {
      draft.uploadType = type;
    });
  },
  getUploadType: (uploaderKey) => {
    const uploader = get().getUploader(uploaderKey);
    return uploader ? uploader.uploadType : 'prompt';
  },
  upload: async (uploader, upload, bucket) => {
    const { s3Client, tlonHostingCredentials, updateStatus, updateFile } =
      get();

    const { key, file } = upload;
    updateStatus(uploader, key, 'loading');

    // Logic for uploading with Tlon Hosting storage.
    if (tlonHostingCredentials) {
      // The first step is to send the PUT request to the proxy, which will
      // respond with a redirect to a pre-signed url to the actual bucket. The
      // token is in the url, not a header, so that it disappears after the
      // redirect.
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      };
      const { endpoint, token } = tlonHostingCredentials;
      const url = `${endpoint}/${key}`;
      const urlWithToken = `${url}?token=${token}`;
      fetch(urlWithToken, requestOptions)
        .then(async (response) => {
          if (response.status !== 200) {
            const body = await response.text();
            throw new Error(body || 'Incorrect response status');
          }
          // When the PUT succeeded, we fetch the actual URL of the file. We do
          // this to avoid having to proxy every single GET request, and to
          // avoid remembering which file corresponds to which bucket, when
          // using multiple buckets internally.
          const fileUrlResponse = await fetch(url);
          const fileUrl = await fileUrlResponse.json();
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
            `Tlon Hosting upload error: ${error.message}, contact support if it persists.`
          );
          console.log({ error });
        });
    }

    // Logic for uploading with S3.
    if (s3Client) {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: file.type,
        ContentLength: file.size,
        ACL: 'public-read',
      });

      const url = await getSignedUrl(s3Client, command);

      s3Client
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
    }
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
  uploadType: 'prompt',
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
    // Add to DOM for mobile Safari support
    input.classList.add('hidden');
    document.body.appendChild(input);
    input.click();
  },
});

function useS3Client() {
  const {
    backend,
    s3: { credentials, configuration },
    tlonHosting,
  } = useStorage();
  const { s3Client, createS3Client, setTlonHostingCredentials } =
    useFileStore();
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    const hasCreds =
      backend === 's3'
        ? credentials?.accessKeyId &&
          credentials?.endpoint &&
          credentials?.secretAccessKey
        : backend === 'tlon-hosting'
        ? !!tlonHosting
        : false;
    if (hasCreds) {
      setHasCredentials(true);
    }
  }, [backend, credentials, tlonHosting]);

  const initClient = useCallback(async () => {
    if (credentials) {
      if (backend === 's3') {
        await createS3Client(credentials, configuration.region);
      }
      if (backend === 'tlon-hosting') {
        await setTlonHostingCredentials(tlonHosting);
      }
    }
  }, [
    backend,
    createS3Client,
    credentials,
    configuration,
    setTlonHostingCredentials,
    tlonHosting,
  ]);

  useEffect(() => {
    if (hasCredentials && !s3Client) {
      initClient();
    }
  }, [s3Client, hasCredentials, initClient]);

  return s3Client;
}

const selUploader = (key: string) => (s: FileStore) => s.uploaders[key];
export function useUploader(key: string): Uploader | undefined {
  const {
    tlonHosting: { token },
    s3: {
      configuration: { currentBucket },
    },
  } = useStorage();
  const s3Client = useS3Client();
  const uploader = useFileStore(selUploader(key));

  useEffect(() => {
    if ((s3Client && currentBucket) || token) {
      useFileStore.setState(
        produce((draft) => {
          draft.uploaders[key] = emptyUploader(key, currentBucket);
        })
      );
    }

    return () => {
      useFileStore.setState(
        produce((draft) => {
          delete draft.uploaders[key];
        })
      );
    };
  }, [s3Client, currentBucket, key, token]);

  return uploader;
}
(window as any).fileUploader = useFileStore.getState;
(window as any).emptyUploader = emptyUploader;
(window as any).warehouse = useStorage.getState;
