import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ImageViewerScreenView } from '@tloncorp/ui';

import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ImageViewer'>;

export default function ImageViewerScreen(props: Props) {
  const postParam = props.route.params.post;
  const uriParam = props.route.params.uri;

  return (
    <ImageViewerScreenView
      post={postParam}
      uri={uriParam}
      goBack={() => props.navigation.pop()}
    />
  );
}
