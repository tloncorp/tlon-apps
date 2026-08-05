import { File } from 'expo-file-system';

export async function getLocalFileSize(uri: string): Promise<number> {
  // File.size is 0 when the file does not exist or cannot be read.
  return new File(uri).size;
}
