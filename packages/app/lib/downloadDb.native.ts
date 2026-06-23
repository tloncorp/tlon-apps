import { Directory, File, Paths } from 'expo-file-system';
import { Platform, Share } from 'react-native';

import { exportDb } from './nativeDb';

export async function downloadDb(): Promise<string | null> {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const exportFile = new File(Paths.cache, `tlon-${timestamp}.sqlite`);
  if (exportFile.exists) exportFile.delete();
  await exportDb(decodeURIComponent(exportFile.uri.replace(/^file:\/\//, '')));

  try {
    if (Platform.OS === 'ios') {
      await Share.share({ url: exportFile.uri });
      return exportFile.uri;
    }

    if (Platform.OS === 'android') {
      const destination = (await Directory.pickDirectoryAsync()).createFile(
        exportFile.name,
        'application/vnd.sqlite3'
      );
      destination.write(await exportFile.bytes());
      return destination.uri;
    }

    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/cancel/i.test(message)) return null;
    throw e;
  } finally {
    if (exportFile.exists) exportFile.delete();
  }
}
