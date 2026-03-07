import { JSONContent } from '@tloncorp/api/urbit';
import { Attachment, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import { useEffect, useRef } from 'react';

import { GalleryDraftType } from '../draftInputs/shared';

const IMAGE_FILE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|heic|heif|bmp|tiff?)$/i;
const shareIntentLogger = createDevLogger('shareIntent', true);

const isLikelyImageFile = (file: db.PendingShareIntentFile) => {
  if (file.mimeType?.startsWith('image/')) {
    return true;
  }
  const sourceName = file.fileName || file.path;
  return IMAGE_FILE_EXTENSION_REGEX.test(sourceName);
};

const uploadIntentFromPendingShareFile = (
  file: db.PendingShareIntentFile
): Attachment.UploadIntent | null => {
  const localUri = file.path?.trim();
  if (!localUri) {
    return null;
  }

  if (isLikelyImageFile(file)) {
    return {
      type: 'image',
      asset: {
        uri: localUri,
        width: file.width ?? 0,
        height: file.height ?? 0,
        fileSize: file.size ?? undefined,
        mimeType: file.mimeType ?? undefined,
      },
    };
  }

  return {
    type: 'fileUri',
    localUri,
    name: file.fileName || localUri.split('/').pop(),
    size: file.size ?? 0,
    mimeType: file.mimeType ?? undefined,
    voiceMemo: false,
  };
};

type UseConsumePendingShareIntentArgs = {
  attachAssets: (assets: Attachment.UploadIntent[]) => void;
  canWrite: boolean;
  channelType: db.Channel['type'];
  isFocused: boolean;
  openDraft: () => void;
  storeDraft: (
    draft: JSONContent,
    draftType?: GalleryDraftType
  ) => Promise<void>;
};

const clearPendingShareIntentIfCurrent = async (createdAt: number) => {
  const latestPendingShare = await db.pendingShareIntent.getValue();
  if (!latestPendingShare || latestPendingShare.createdAt !== createdAt) {
    return;
  }
  await db.pendingShareIntent.resetValue();
};

export const useConsumePendingShareIntent = ({
  attachAssets,
  canWrite,
  channelType,
  isFocused,
  openDraft,
  storeDraft,
}: UseConsumePendingShareIntentArgs) => {
  const pendingShareInFlightRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!canWrite || !isFocused) {
        return;
      }

      const pendingShare = await db.pendingShareIntent.getValue();
      if (!pendingShare || cancelled) {
        return;
      }

      if (pendingShareInFlightRef.current === pendingShare.createdAt) {
        return;
      }

      const pendingShareFile = db.getPrimaryPendingShareIntentFile(pendingShare);
      const uploadIntent =
        pendingShareFile && uploadIntentFromPendingShareFile(pendingShareFile);

      if (channelType === 'gallery' && uploadIntent?.type === 'fileUri') {
        return;
      }

      const sharedText = db.getPendingShareIntentText(pendingShare);
      const hasSharedText = Boolean(sharedText);
      const hasShareFile = Boolean(uploadIntent);

      if (!hasShareFile && !hasSharedText) {
        await db.pendingShareIntent.resetValue();
        return;
      }

      if (cancelled) {
        return;
      }

      pendingShareInFlightRef.current = pendingShare.createdAt;
      let processed = false;

      try {
        if (sharedText) {
          if (cancelled) {
            return;
          }
          await storeDraft(
            logic.textAndMentionsToContent(sharedText, []),
            channelType === 'gallery' ? 'caption' : undefined
          );
        }

        if (uploadIntent) {
          if (cancelled) {
            return;
          }
          attachAssets([uploadIntent]);
        }

        if (cancelled) {
          return;
        }

        processed = true;
        openDraft();
      } catch (err) {
        shareIntentLogger.error('Failed to consume pending share intent', err);
      } finally {
        if (processed) {
          try {
            await clearPendingShareIntentIfCurrent(pendingShare.createdAt);
          } catch (err) {
            shareIntentLogger.error('Failed to clear pending share intent', err);
          }
        }
        if (pendingShareInFlightRef.current === pendingShare.createdAt) {
          pendingShareInFlightRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attachAssets, canWrite, channelType, isFocused, openDraft, storeDraft]);
};
