import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { createDevLogger } from '../../debug';
import {
  Attachment,
  FinalizedAttachment,
  UploadState,
  UploadStateError,
} from '../../domain';

const logger = createDevLogger('uploadState', false);
let uploadStates: Record<Attachment.UploadIntent.Key, UploadState> = {};

export type UploadStateListener = (state: UploadState) => void;
const uploadStateListeners: UploadStateListener[] = [];

export const setUploadState = (
  key: Attachment.UploadIntent.Key,
  state: UploadState
) => {
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

export const useUploadStates = (keys: Attachment.UploadIntent.Key[]) => {
  const states = useSyncExternalStore(
    subscribeToUploadStates,
    useCallback(() => {
      return uploadStates;
    }, [])
  );
  return useMemo(() => {
    return keys.reduce(
      (memo, k) => {
        return {
          ...memo,
          [k]: states[k],
        };
      },
      {} as Record<Attachment.UploadIntent.Key, UploadState>
    );
  }, [states, keys]);
};

export function finalizeAttachmentsLocal(
  attachments: Attachment[]
): FinalizedAttachment[] {
  return attachments.map((attachment) => {
    const uploadIntent = Attachment.toUploadIntent(attachment);
    if (uploadIntent.needsUpload) {
      return Attachment.UploadIntent.toLocalFinalizedAttachment(uploadIntent)!;
    } else {
      return uploadIntent.finalized;
    }
  });
}

export async function finalizeAttachments(
  attachments: Attachment[]
): Promise<FinalizedAttachment[]> {
  const assetAttachments: Attachment.UploadIntent[] = attachments.flatMap(
    (x) => {
      const uploadIntent = Attachment.toUploadIntent(x);
      return uploadIntent.needsUpload ? uploadIntent : [];
    }
  );
  const completedUploads = await waitForUploads(
    assetAttachments.map(Attachment.UploadIntent.extractKey)
  );
  return attachments
    .map((x) => Attachment.toUploadIntent(x))
    .map((uploadIntent) => {
      if (uploadIntent.needsUpload) {
        const upload =
          completedUploads[Attachment.UploadIntent.extractKey(uploadIntent)];
        if (upload == null) {
          throw new Error(`No upload found for upload intent: ${uploadIntent}`);
        }
        const finalized = Attachment.UploadIntent.toFinalizedAttachment(
          uploadIntent,
          upload
        );
        if (finalized == null) {
          throw new Error('Attachment is not an uploaded image attachment');
        }
        return finalized;
      } else {
        return uploadIntent.finalized;
      }
    });
}

export const waitForUploads = async (
  keys: Attachment.UploadIntent.Key[],
  timeoutMs: number = 60000
) => {
  return new Promise<Record<string, UploadState>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      const pendingKeys = keys.filter(
        (k) => !uploadStates[k] || uploadStates[k]?.status === 'uploading'
      );
      reject(
        new Error(`Upload timed out waiting for: ${pendingKeys.join(', ')}`)
      );
    }, timeoutMs);

    const unsubscribe = subscribeToUploadStates(() => checkUploads());

    const checkUploads = () => {
      const failed = keys.filter((k) => uploadStates[k]?.status === 'error');
      if (failed.length) {
        const message = failed
          .map((k) => (uploadStates[k] as UploadStateError)?.errorMessage)
          .join(', ');
        clearTimeout(timeout);
        unsubscribe();
        reject(new Error(message));
        return;
      }
      // Only consider finished when ALL uploads have a definitive outcome
      // (success or error). Don't treat undefined/initial/uploading as finished.
      const isFinished = keys.every(
        (key) =>
          uploadStates[key]?.status === 'success' ||
          uploadStates[key]?.status === 'error'
      );
      if (isFinished) {
        clearTimeout(timeout);
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
