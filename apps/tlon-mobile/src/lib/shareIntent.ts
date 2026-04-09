import type {
  ShareIntentFile as AppShareIntentFile,
  ChannelShareIntent,
} from '@tloncorp/app/types/shareIntent';
import {
  type ShareIntentFile as ExpoShareIntentFile,
  type ShareIntent,
} from 'expo-share-intent';

const mapShareIntentFile = (
  file: ExpoShareIntentFile
): AppShareIntentFile | null => {
  if (!file.path) {
    return null;
  }

  return {
    path: file.path,
    fileName: file.fileName || null,
    mimeType: file.mimeType || null,
    size: file.size,
    width: file.width,
    height: file.height,
    duration: file.duration,
  };
};

export const getShareIntentFingerprint = (shareIntent: ShareIntent): string => {
  return JSON.stringify({
    text: shareIntent.text,
    webUrl: shareIntent.webUrl,
    filePaths: shareIntent.files?.map((file) => file.path) ?? null,
    type: shareIntent.type,
  });
};

const extractSharedFile = (
  files: ShareIntent['files']
): AppShareIntentFile | null => {
  if (!files?.length) {
    return null;
  }

  for (const file of files) {
    const mappedFile = mapShareIntentFile(file);
    if (mappedFile) {
      return mappedFile;
    }
  }

  return null;
};

export const toChannelShareIntent = (
  shareIntent: ShareIntent
): ChannelShareIntent | null => {
  const text = shareIntent.text?.trim() || null;
  const webUrl = shareIntent.webUrl?.trim() || null;
  const file = extractSharedFile(shareIntent.files);

  return text || webUrl || file
    ? {
        createdAt: Date.now(),
        text,
        webUrl,
        file,
      }
    : null;
};
