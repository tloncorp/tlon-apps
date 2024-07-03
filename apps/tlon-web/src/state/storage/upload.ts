import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { deSig, formatDa, unixToDa } from '@urbit/aura';
import imageCompression from 'browser-image-compression';
import produce from 'immer';
import _ from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { getImageSize } from 'react-image-size';
import create from 'zustand';

import api from '@/api';
import { isIOSWebView, isSafari } from '@/logic/native';
import { Status } from '@/logic/status';

import { useStorage } from './storage';
import {
  FileStore,
  StorageConfiguration,
  StorageCredentials,
  Uploader,
} from './type';

function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}

function imageSize(url: string) {
  const size = getImageSize(url)
    .then<[number, number]>(({ width, height }) => [width, height])
    .catch((e) => {
      console.log('failed to get image size', { e });
      return undefined;
    });
  return size;
}

function videoSize(url: string) {
  const video = document.createElement('video');
  video.src = url;
  video.load();
  const size = new Promise<[number, number]>((resolve) => {
    video.addEventListener('loadedmetadata', () => {
      resolve([video.videoWidth, video.videoHeight]);
    });
  });
  return size;
}

function isImageFile(file: File) {
  const acceptedImageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
  ];
  return acceptedImageTypes.includes(file.type);
}

function isVideoFile(file: File) {
  const acceptedVideoTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
  ];
  return acceptedVideoTypes.includes(file.type);
}

export const useFileStore = create<FileStore>((set, get) => ({
  client: null,
  uploaders: {},
  createClient: (credentials: StorageCredentials, region: string) => {
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
  getUploader: (key) => {
    const { uploaders } = get();

    return uploaders[key];
  },
  update: (key: string, updateFn: (uploader: Uploader) => void) => {
    set(produce((draft) => updateFn(draft.uploaders[key])));
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
  uploadFiles: async (uploader, files, config) => {
    if (!files) return;

    const fileList = [...files].map((file) => ({
      file,
      key: `${window.ship}/${deSig(
        formatDa(unixToDa(new Date().getTime()))
      )}-${file.name.split(' ').join('-')}`,
      status: 'initial' as Status,
      url: '',
      size: [0, 0] as [number, number],
    }));

    const newFiles = _.keyBy(fileList, 'key');

    const { update, upload } = get();

    update(uploader, (draft) => {
      draft.files = { ...draft.files, ...newFiles };
    });

    fileList.forEach((f) => upload(uploader, f, config));
  },
  upload: async (uploader, upload, config) => {
    const { client, updateStatus, updateFile } = get();

    const { key, file } = upload;
    updateStatus(uploader, key, 'loading');

    const compressionOptions = {
      maxSizeMB: 1,
      useWebWorker: true,
    };

    // if compression fails for some reason, we'll just use the original file.
    let compressedFile: File = file;

    try {
      // TODO: fix upload compression for Safari and iOS webview
      if (isImageFile(file) && !isIOSWebView() && !isSafari()) {
        compressedFile = await imageCompression(file, compressionOptions);
      }
    } catch (error) {
      console.log({ error });
    }

    // Logic for uploading with Tlon Hosting storage.
    if (config.service === 'presigned-url' && config.presignedUrl) {
      // The first step is to send the PUT request to the proxy, which will
      // respond with a redirect to a pre-signed url to the actual bucket. The
      // token is in the url, not a header, so that it disappears after the
      // redirect.

      try {
        const requestOptions = {
          method: 'PUT',
          headers: {
            'Content-Type': compressedFile.type,
            'Cache-Control': 'public, max-age=3600',
          },
          body: compressedFile,
        };
        const { presignedUrl } = config;
        const url = `${presignedUrl}/${key}`;
        const token = await api
          .scry<string>({
            app: 'genuine',
            path: '/secret',
          })
          .catch((e) => {
            console.log('failed to get secret', { e });
            return '';
          });
        const urlWithToken = `${url}?token=${token}`;
        fetch(urlWithToken, requestOptions)
          .then(async (response) => {
            if (response.status !== 200) {
              const body = await response.text().catch(() => {
                console.log(
                  'Error parsing response body, body, response status not 200'
                );
                return '';
              });
              throw new Error(body || 'Incorrect response status');
            }
            // When the PUT succeeded, we fetch the actual URL of the file. We do
            // this to avoid having to proxy every single GET request, and to
            // avoid remembering which file corresponds to which bucket, when
            // using multiple buckets internally.
            const fileUrlResponse = await fetch(url);
            const fileUrl = await fileUrlResponse.json().catch(() => {
              console.log('Error parsing response body, fileUrlResponse');
              return '';
            });
            updateStatus(uploader, key, 'success');
            if (isImageFile(file)) {
              imageSize(fileUrl)
                .then((s) =>
                  updateFile(uploader, key, {
                    size: s,
                    url: fileUrl,
                  })
                )
                .catch((e) => {
                  console.log('failed to get image size', { e });
                  return '';
                });
            } else if (isVideoFile(file)) {
              videoSize(fileUrl)
                .then((s) =>
                  updateFile(uploader, key, {
                    size: s,
                    url: fileUrl,
                  })
                )
                .catch((e) => {
                  console.log('failed to get video size', { e });
                  return '';
                });
            }
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
      } catch (error: any) {
        updateStatus(
          uploader,
          key,
          'error',
          `Tlon Hosting upload error: ${error.message}, contact support if it persists.`
        );
        console.log({ error });
      }
    }

    // Logic for uploading with S3.
    if (config.service === 'credentials' && client) {
      const command = new PutObjectCommand({
        Bucket: config.currentBucket,
        Key: key,
        Body: compressedFile,
        ContentType: compressedFile.type,
        ContentLength: compressedFile.size,
        ACL: 'public-read',
      });

      const { isSecureContext } = window;

      let s3Url: URL;

      if (config.publicUrlBase) {
        s3Url = new URL(key, config.publicUrlBase);
      } else {
        s3Url = new URL(
          await getSignedUrl(client, command)
            .then((res) => res.split('?')[0])
            .catch((e) => {
              console.log('failed to get signed url', { e });
              return '';
            })
        );
      }

      const url = config.publicUrlBase
        ? s3Url.toString()
        : await getSignedUrl(client, command)
            .then((res) => res.split('?')[0])
            .catch((e) => {
              console.log('failed to get signed url', { e });
              return '';
            });

      if (
        isSecureContext &&
        config.publicUrlBase &&
        s3Url.protocol !== 'https:'
      ) {
        updateStatus(
          uploader,
          key,
          'error',
          `S3 upload error: Attempting to upload to non-secure S3 endpoint from secure (https) context.`
        );
        return;
      }

      client
        .send(command)
        .then(() => {
          updateStatus(uploader, key, 'success');
          if (isImageFile(file)) {
            imageSize(url)
              .then((s) =>
                updateFile(uploader, key, {
                  size: s,
                  url,
                })
              )
              .catch((e) => {
                console.log('failed to get image size', { e });
                return '';
              });
          } else if (isVideoFile(file)) {
            videoSize(url)
              .then((s) =>
                updateFile(uploader, key, {
                  size: s,
                  url,
                })
              )
              .catch((e) => {
                console.log('failed to get video size', { e });
                return '';
              });
          }
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

const emptyUploader = (
  key: string,
  config: StorageConfiguration
): Uploader => ({
  files: {},
  getMostRecent: () => useFileStore.getState().getMostRecent(key),
  uploadFiles: async (files) =>
    useFileStore.getState().uploadFiles(key, files, config),
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
      useFileStore.getState().uploadFiles(key, files, config);
      input.remove();
    });
    // Add to DOM for mobile Safari support
    input.classList.add('hidden');
    document.body.appendChild(input);
    input.click();
  },
});

function useClient() {
  const {
    s3: { credentials, configuration },
  } = useStorage();
  const { client, createClient } = useFileStore();
  const [hasCredentials, setHasCredentials] = useState(false);

  useEffect(() => {
    const hasCreds =
      configuration.service === 'credentials' &&
      credentials?.accessKeyId &&
      credentials?.endpoint &&
      credentials?.secretAccessKey;
    if (hasCreds) {
      setHasCredentials(true);
    }
  }, [credentials, configuration]);

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

const selUploader = (key: string) => (s: FileStore) => s.uploaders[key];
export function useUploader(key: string): Uploader | undefined {
  const {
    s3: { configuration },
  } = useStorage();
  const client = useClient();
  const uploader = useFileStore(selUploader(key));

  useEffect(() => {
    if (
      (client && configuration.service === 'credentials') ||
      (configuration.service === 'presigned-url' && configuration.presignedUrl)
    ) {
      useFileStore.setState(
        produce((draft) => {
          draft.uploaders[key] = emptyUploader(key, configuration);
        })
      );
    }
  }, [client, configuration, key]);

  return uploader;
}
(window as any).fileUploader = useFileStore.getState;
(window as any).emptyUploader = emptyUploader;
(window as any).warehouse = useStorage.getState;
