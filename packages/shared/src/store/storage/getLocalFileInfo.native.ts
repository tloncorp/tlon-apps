import * as FileSystem from 'expo-file-system/legacy';

export async function getLocalFileInfo(
  uri: string
): Promise<{ size: number; mimeType?: string }> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  return { size: fileInfo.exists ? fileInfo.size : 0 };
}
