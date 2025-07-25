import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { createDevLogger } from '../../debug';
import {
  Attachment,
  FinalizedAttachment,
  ImageAttachment,
  UploadState,
  UploadStateError,
  UploadedImageAttachment,
} from '../../domain';

const logger = createDevLogger('uploadState', false);
let uploadStates: Record<string, UploadState> = {};

export type UploadStateListener = (state: UploadState) => void;
const uploadStateListeners: UploadStateListener[] = [];

export const setUploadState = (key: string, state: UploadState) => {
  uploadStates = { ...uploadStates, [key]: state };
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
  const states = useSyncExternalStore(
    subscribeToUploadStates,
    useCallback(() => {
      return uploadStates;
    }, [])
  );
  return useMemo(() => {
    return keys.reduce<Record<string, UploadState>>((memo, k) => {
      return {
        ...memo,
        [k]: states[k],
      };
    }, {});
  }, [states, keys]);
};

const isImageAttachment = (a: Attachment): a is ImageAttachment =>
  a.type === 'image';
const requiresUpload = isImageAttachment;

export function finalizeAttachmentsLocal(
  attachments: Attachment[]
): FinalizedAttachment[] {
  return attachments.map((attachment) => {
    if (requiresUpload(attachment)) {
      return buildFinalizedImageAttachment(attachment, {
        status: 'uploading',
        localUri: attachment.file.uri,
      });
    } else {
      return attachment;
    }
  });
}

export async function finalizeAttachments(
  attachments: Attachment[]
): Promise<FinalizedAttachment[]> {
  const assetAttachments = attachments.filter(requiresUpload);
  const completedUploads = await waitForUploads(
    assetAttachments.map((a) => a.file.uri)
  );
  return attachments.map((attachment) => {
    if (requiresUpload(attachment)) {
      return buildFinalizedImageAttachment(
        attachment,
        completedUploads[attachment.file.uri]
      );
    } else {
      return attachment;
    }
  });
}

function buildFinalizedImageAttachment(
  attachment: ImageAttachment,
  uploadState: UploadState
): UploadedImageAttachment {
  switch (uploadState.status) {
    case 'error':
      throw new Error('Attachment is not an uploaded image attachment');

    case 'success':
    // fallthrough
    case 'uploading':
      return {
        ...attachment,
        uploadState,
      };
  }
}

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
