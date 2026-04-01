import type { ShareIntentFile as AppShareIntentFile } from '@tloncorp/app/types/shareIntent';
import {
  type ShareIntent,
  type ShareIntentFile as ExpoShareIntentFile,
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

export const extractSharedText = (shareIntent: ShareIntent): string | null => {
  const text = shareIntent.text?.trim();
  const webUrl = shareIntent.webUrl?.trim();

  if (text && webUrl && text.includes(webUrl)) {
    return text;
  }

  if (text && webUrl) {
    return `${text}\n${webUrl}`;
  }

  return text || webUrl || null;
};

export const extractSharedFile = (
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
