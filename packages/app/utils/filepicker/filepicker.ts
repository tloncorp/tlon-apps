import * as DocumentPicker from 'expo-document-picker';

import { PickFile } from './types';

export const pickFile: PickFile = async () => {
  const results = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (results.assets == null) {
    return [];
  }

  return results.assets?.map((res) => ({
    type: 'uri',
    uri: res.uri,
  }));
};
