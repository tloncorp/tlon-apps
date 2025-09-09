import Clipboard from '@react-native-clipboard/clipboard';

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