import * as DocumentPicker from 'expo-document-picker';

export async function pickFile(): Promise<
  ({ type: 'uri'; uri: string } | { type: 'file'; file: File })[]
> {
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
          type: 'uri',
          uri: res.uri,
        }
      : {
          type: 'file',
          file: res.file,
        }
  );
}
