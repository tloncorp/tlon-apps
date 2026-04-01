import { File } from 'expo-file-system/next';

export function getMd5(uri: string): string | null {
  return new File(uri).md5;
}
