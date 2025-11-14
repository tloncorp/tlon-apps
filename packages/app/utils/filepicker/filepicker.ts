import { pick } from '@react-native-documents/picker';

import { PickFile } from './types';

export const pickFile: PickFile = async () => {
  const [first, ...rest] = await pick();

  return [first, ...rest].map((res) => ({
    type: 'uri',
    uri: res.uri,
  }));
};
