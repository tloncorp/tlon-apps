import { File } from 'expo-file-system';

export function getMd5(uri: string): string | null {
  return new File(uri).md5;
}
