import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { deSig, formatDa, unixToDa } from '@urbit/aura';
import produce from 'immer';
import _ from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import create from 'zustand';

import type {
  FileStore,
  Status,
  StorageConfiguration,
  StorageCredentials,
  Uploader,
} from '../../api';
import * as api from '../../api';
import { createDevLogger } from '../../debug';
import { useStorage } from './storage';
import {
  getFinalMemexUrl,
  getMemexUploadUrl,
  getShipInfo,
  hasCustomS3Creds,
} from './utils';

const logger = createDevLogger('upload state', true);

function prefixEndpoint(endpoint: string) {
  return endpoint.match(/https?:\/\//) ? endpoint : `https://${endpoint}`;
}

// function videoSize(url: string) {
// const video = document.createElement('video');
// video.src = url;
// video.load();
// const size = new Promise<[number, number]>((resolve) => {
// video.addEventListener('loadedmetadata', () => {
// resolve([video.videoWidth, video.videoHeight]);
// });
// });
// return size;
// }

function isImageFile(file: Blob) {
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

// TODO: handle video files
// function isVideoFile(file: Blob) {
// const acceptedVideoTypes = [
// 'video/mp4',
// 'video/webm',
// 'video/ogg',
// 'video/quicktime',
// ];
// return acceptedVideoTypes.includes(file.type);
// }

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
  uploadFiles: async (uploader, files, config, imageSizer, nativeUploader) => {
    if (!files) return;

    const shipInfo = await getShipInfo();

    if (!shipInfo) {
      return;
    }

    const fileList = [...files].map((file) => ({
      file,
      key: `${shipInfo.ship}/${deSig(
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

    fileList.forEach((f) =>
      upload(uploader, f, config, imageSizer, undefined, nativeUploader)
    );
  },
  upload: async (
    uploader,
    upload,
    config,
    imageSizer,
    compressor,
    nativeUploader
  ) => {
    const { client, updateStatus, updateFile } = get();

    const { key, file } = upload;
    updateStatus(uploader, key, 'loading');
    const isHostedUpload =
      config.service === 'presigned-url' && config.presignedUrl;
    const isCustomUpload = client !== null;

    // TODO: implement image compression for react-native

    // Native app uses its own uploader which gets passed in
    if (nativeUploader) {
      try {
        if (isHostedUpload) {
          const presignedUrl = await getMemexUploadUrl(key);
          await nativeUploader(presignedUrl, file);
          const finalUrl = await getFinalMemexUrl(presignedUrl);
          updateFile(uploader, key, {
            url: finalUrl,
            size: [file.height ?? 200, file.width ?? 200],
          });
          updateStatus(uploader, key, 'success');
        }

        if (isCustomUpload) {
          const command = new PutObjectCommand({
            Bucket: config.currentBucket,
            Key: key,
            ContentType: file.type,
            ContentLength: file.blob.size,
            ACL: 'public-read',
          });
          const signedUrl = await getSignedUrl(client, command);
          await nativeUploader(signedUrl, file, true);
          updateFile(uploader, key, {
            url: signedUrl.split('?')[0],
            size: [file.height ?? 200, file.width ?? 200],
          });
          updateStatus(uploader, key, 'success');
        }
      } catch (e) {
        console.error(`Filestore: upload failed for ${key}`, e);
        updateStatus(uploader, key, 'error', 'Upload failed');
      }

      return;
    }

    // Pre-existing web upload logic

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
            'Content-Type': file.type,
          },
          body: file.blob,
        };
        const { presignedUrl } = config;
        const url = `${presignedUrl}/${key}`;
        const token = await api
          .scry<string>({
            app: 'genuine',
            path: '/secret',
          })
          .catch((e) => {
            logger.log('failed to get secret', { e });
            return '';
          });
        const urlWithToken = `${url}?token=${token}`;
        fetch(urlWithToken, requestOptions)
          .then(async (response) => {
            if (response.status !== 200) {
              const body = await response.text().catch(() => {
                logger.log(
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
              logger.log('Error parsing response body, fileUrlResponse');
              return '';
            });
            updateStatus(uploader, key, 'success');
            if (isImageFile(file.blob)) {
              imageSizer(fileUrl)
                .then((s) =>
                  updateFile(uploader, key, {
                    size: s,
                    url: fileUrl,
                  })
                )
                .catch((e) => {
                  logger.log('failed to get image size', { e });
                  return '';
                });
            }
            // else if (isVideoFile(file.blob)) {
            // videoSize(fileUrl)
            // .then((s) =>
            // updateFile(uploader, key, {
            // size: s,
            // url: fileUrl,
            // })
            // )
            // .catch((e) => {
            // console.log('failed to get video size', { e });
            // return '';
            // });
            // }
          })
          .catch((error: any) => {
            updateStatus(
              uploader,
              key,
              'error',
              `Tlon Hosting upload error: ${error.message}, contact support if it persists.`
            );
            logger.log({ error });
          });
      } catch (error: any) {
        updateStatus(
          uploader,
          key,
          'error',
          `Tlon Hosting upload error: ${error.message}, contact support if it persists.`
        );
        logger.log({ error });
      }
    }

    // Logic for uploading with S3.
    if (config.service === 'credentials' && client) {
      const command = new PutObjectCommand({
        Bucket: config.currentBucket,
        Key: key,
        Body: file.blob,
        ContentType: file.type,
        ContentLength: file.blob.size,
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
              logger.log('failed to get signed url', { e });
              return '';
            })
        );
      }

      const url = config.publicUrlBase
        ? s3Url.toString()
        : await getSignedUrl(client, command)
            .then((res) => res.split('?')[0])
            .catch((e) => {
              logger.log('failed to get signed url', { e });
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
          if (isImageFile(file.blob)) {
            imageSizer(url)
              .then((s) =>
                updateFile(uploader, key, {
                  size: s,
                  url,
                })
              )
              .catch((e) => {
                logger.log('failed to get image size', { e });
                return '';
              });
          }
          // else if (isVideoFile(file.blob)) {
          // videoSize(url)
          // .then((s) =>
          // updateFile(uploader, key, {
          // size: s,
          // url,
          // })
          // )
          // .catch((e) => {
          // console.log('failed to get video size', { e });
          // return '';
          // });
          // }
        })
        .catch((error: any) => {
          updateStatus(
            uploader,
            key,
            'error',
            `S3 upload error: ${error.message}, check your S3 configuration.`
          );
          logger.log({ error });
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
        logger.error(msg);
        draft.files[fileKey].errorMessage = msg;
      }
    });
  },
  removeByURL: (uploader, url) => {
    get().update(uploader, (draft) => {
      const { files } = draft;
      draft.files = Object.fromEntries(
        Object.entries(files).filter(([, f]) => f.url !== url)
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
  config: StorageConfiguration,
  imageSizer: (url: string) => Promise<[number, number]>,
  nativeUploader?: api.NativeUploader
): Uploader => ({
  files: {},
  getMostRecent: () => useFileStore.getState().getMostRecent(key),
  uploadFiles: async (files) =>
    useFileStore
      .getState()
      .uploadFiles(key, files, config, imageSizer, nativeUploader),
  clear: () => useFileStore.getState().clear(key),
  removeByURL: (url) => useFileStore.getState().removeByURL(key, url),
  uploadType: 'prompt',
});

export type CustomStorageConfig = {
  publicUrlBase?: string;
  bucket: string;
  client: S3Client;
};

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
export function useUploader(
  key: string,
  imageSizer: (url: string) => Promise<[number, number]>,
  nativeUploader?: api.NativeUploader
): Uploader | undefined {
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
          draft.uploaders[key] = emptyUploader(
            key,
            configuration,
            imageSizer,
            nativeUploader
          );
        })
      );
    }
  }, [client, configuration, key, imageSizer, nativeUploader]);

  return uploader;
}
