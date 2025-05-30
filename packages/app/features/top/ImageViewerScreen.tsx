import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../../navigation/types';
import { ImageViewerScreenView } from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ImageViewer'>;

export default function ImageViewerScreen(props: Props) {
  const uriParam = props.route.params.uri;

  return (
    <ImageViewerScreenView
      uri={uriParam}
      goBack={() => props.navigation.pop()}
    />
  );
}
