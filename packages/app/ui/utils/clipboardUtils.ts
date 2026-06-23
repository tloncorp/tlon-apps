import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import type * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { getFileSize } from '../../utils/files';
import { imageSize } from '../../utils/images';

const CLIPBOARD_IMAGE_DIR = `${FileSystem.cacheDirectory ?? ''}clipboard-images/`;
const CLIPBOARD_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
};

function getClipboardImageExtension(mimeType: string): string {
  return CLIPBOARD_IMAGE_EXTENSIONS[mimeType.toLowerCase()] ?? '.png';
}

function normalizeClipboardImageData({
  data,
  mimeType,
}: {
  data: string;
  mimeType: string;
}) {
  const match = data.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    return { base64Data: data, mimeType };
  }

  if (match[2] !== ';base64') {
    throw new Error('Clipboard image data must be base64 encoded');
  }

  return {
    base64Data: match[3],
    mimeType: match[1] || mimeType,
  };
}

export const tryGetImageWithFormat = async (
  getter: () => Promise<{ data: string } | null>,
  mimeType: string
): Promise<{ data: string; mimeType: string } | null> => {
  try {
    const result = await getter();
    if (result?.data) {
      return { data: result.data, mimeType };
    }
    return null;
  } catch {
    return null;
  }
};

export const getClipboardImageWithFallbacks = async (): Promise<{
  data: string;
  mimeType: string;
} | null> => {
  if (Platform.OS === 'android' || !(await Clipboard.hasImageAsync()))
    return null;

  // Try iOS-specific methods first, then fall back to generic
  const attempts = [
    () =>
      tryGetImageWithFormat(
        () => Clipboard.getImageAsync({ format: 'png' }),
        'image/png'
      ),
    () =>
      tryGetImageWithFormat(
        () => Clipboard.getImageAsync({ format: 'jpeg' }),
        'image/jpeg'
      ),
  ];

  for (const attempt of attempts) {
    const result = await attempt();
    if (result) return result;
  }

  return null;
};

export const createImageAssetFromClipboardData = async (clipboardData: {
  data: string;
  mimeType: string;
}): Promise<ImagePicker.ImagePickerAsset> => {
  if (!FileSystem.cacheDirectory) {
    throw new Error('File system cache directory is unavailable');
  }

  const { base64Data, mimeType } = normalizeClipboardImageData(clipboardData);
  const extension = getClipboardImageExtension(mimeType);
  const id = `clipboard-${Date.now()}`;
  const uri = `${CLIPBOARD_IMAGE_DIR}${id}${extension}`;

  await FileSystem.makeDirectoryAsync(CLIPBOARD_IMAGE_DIR, {
    intermediates: true,
  });
  await FileSystem.writeAsStringAsync(uri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });

  let width = 300;
  let height = 300;
  try {
    [width, height] = await imageSize(uri);
  } catch {
    // Fall back to a square preview if React Native cannot read dimensions.
  }

  return {
    assetId: id,
    uri,
    width,
    height,
    fileName: `clipboard-image${extension}`,
    fileSize: getFileSize(uri) ?? 0,
    mimeType,
    type: 'image',
    duration: undefined,
    exif: undefined,
    base64: undefined,
  };
};
