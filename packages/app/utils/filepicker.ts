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

  return results.assets?.map(
    (res): Attachment.UploadIntent =>
      res.file == null
        ? {
            type: 'fileUri',
            name: res.name,
            localUri: res.uri,
            size: res.size ?? -1, // not sure when size would be undefined, but it's in the types...
            mimeType: res.mimeType,
          }
        : {
            type: 'file',
            file: res.file,
          }
  );
}
