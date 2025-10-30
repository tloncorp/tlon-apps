import Clipboard from '@react-native-clipboard/clipboard';
import * as ImagePicker from 'expo-image-picker';

export const tryGetImageWithFormat = async (
  getter: () => Promise<string>,
  mimeType: string
): Promise<{ data: string; mimeType: string } | null> => {
  try {
    const data = await getter();
    return { data, mimeType };
  } catch {
    return null;
  }
};

export const getClipboardImageWithFallbacks = async (): Promise<{
  data: string;
  mimeType: string;
} | null> => {
  if (!(await Clipboard.hasImage())) return null;

  // Try iOS-specific methods first, then fall back to generic
  const attempts = [
    () => tryGetImageWithFormat(() => Clipboard.getImagePNG(), 'image/png'),
    () => tryGetImageWithFormat(() => Clipboard.getImageJPG(), 'image/jpeg'),
    () => tryGetImageWithFormat(() => Clipboard.getImage(), 'image/png'),
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
