import type { Attachment } from '@tloncorp/shared/domain';
import * as DocumentPicker from 'expo-document-picker';

export async function pickFile(): Promise<Attachment.UploadIntent[]> {
  const results = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
    type: ['*/*'],
  });

  if (results.assets == null) {
    return [];
  }

  return results.assets?.map((res) =>
    res.file == null
      ? {
          type: 'fileUri',
          name: res.name,
          localUri: res.uri,
        }
      : {
          type: 'file',
          file: res.file,
        }
  );
}
