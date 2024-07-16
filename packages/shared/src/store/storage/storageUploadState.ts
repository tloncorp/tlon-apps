import { useCallback, useRef, useSyncExternalStore } from 'react';

import { createDevLogger } from '../../debug';

export type UploadStateError = { status: 'error'; errorMessage: string };
export type UploadStateUploading = { status: 'uploading'; localUri: string };
export type UploadStateSuccess = { status: 'success'; remoteUri: string };

export type UploadState =
  | UploadStateError
  | UploadStateUploading
  | UploadStateSuccess;

const logger = createDevLogger('uploadState', true);
const uploadStates: Record<string, UploadState> = {};

export type UploadStateListener = (state: UploadState) => void;
const uploadStateListeners: UploadStateListener[] = [];

export const setUploadState = (key: string, state: UploadState) => {
  uploadStates[key] = state;
  logger.log('upload states changed', uploadStates);
  uploadStateListeners.forEach((listener) => listener(uploadStates[key]));
};

export function subscribeToUploadStates(listener: UploadStateListener) {
  uploadStateListeners.push(listener);
  return () => {
    uploadStateListeners.splice(uploadStateListeners.indexOf(listener), 1);
  };
}

export const useUploadStates = (keys: string[]) => {
  const keyHash = keys.join('');
  const cache = useRef<Record<string, Record<string, UploadState>>>({});
  return useSyncExternalStore(
    subscribeToUploadStates,
    useCallback(() => {
      if (!cache.current[keyHash]) {
        cache.current = {
          [keyHash]: keys.reduce<Record<string, UploadState>>((acc, key) => {
            acc[key] = uploadStates[key];
            return acc;
          }, {}),
        };
      }
      return cache.current[keyHash];
      // Using keyHash to determine when keys change
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyHash])
  );
};

export const waitForUploads = async (keys: string[]) => {
  return new Promise<Record<string, UploadState>>((resolve, reject) => {
    const unsubscribe = subscribeToUploadStates(() => checkUploads());
    const checkUploads = () => {
      const failed = keys.filter((k) => uploadStates[k]?.status === 'error');
      if (failed.length) {
        const message = failed
          .map((k) => (uploadStates[k] as UploadStateError)?.errorMessage)
          .join(', ');
        unsubscribe();
        reject(new Error(message));
      }
      const isFinished = keys.every(
        (key) => !uploadStates[key] || uploadStates[key]?.status !== 'uploading'
      );
      if (isFinished) {
        unsubscribe();
        resolve(
          keys.reduce<Record<string, UploadState>>((memo, k) => {
            return {
              ...memo,
              [k]: uploadStates[k],
            };
          }, {})
        );
      }
    };
    checkUploads();
  });
};
