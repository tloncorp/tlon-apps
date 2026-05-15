import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

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

export const createImageAssetFromClipboardData = (clipboardData: {
  data: string;
  mimeType: string;
}): ImagePicker.ImagePickerAsset => {
  const { data: imageData, mimeType } = clipboardData;

  const uri = imageData.startsWith('data:')
    ? imageData
    : `data:${mimeType};base64,${imageData}`;

  return {
    assetId: `clipboard-${Date.now()}`,
    uri,
    width: 300,
    height: 300,
    fileName:
      mimeType === 'image/jpeg' ? 'clipboard-image.jpg' : 'clipboard-image.png',
    fileSize: 0,
    type: 'image',
    duration: undefined,
    exif: undefined,
    base64: undefined,
  };
};
