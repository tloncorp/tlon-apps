import * as FileSystem from 'expo-file-system/legacy';

export async function getLocalFileSize(uri: string): Promise<number> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  return fileInfo.exists ? fileInfo.size : 0;
}
