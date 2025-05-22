import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { getUri } from '../../navigation/utils';
import { ImageViewerScreenView } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ImageViewer'>;

export default function ImageViewerScreen(props: Props) {
  const uriParam = getUri(props.route);

  return (
    <ImageViewerScreenView
      uri={uriParam}
      goBack={() => props.navigation.pop()}
    />
  );
}
