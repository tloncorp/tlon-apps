import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ImageViewerScreen from '@tloncorp/app/features/top/ImageViewerScreen';

import type { RootStackParamList } from '../types';

type ImagePreviewScreenControllerProps = NativeStackScreenProps<
  RootStackParamList,
  'ImageViewer'
>;

export default function ImageViewerScreenController(
  props: ImagePreviewScreenControllerProps
) {
  const postParam = props.route.params.post;
  const uriParam = props.route.params.uri;

  return (
    <ImageViewerScreen
      postId={postParam.id}
      uri={uriParam ?? ''}
      goBack={() => props.navigation.pop()}
    />
  );
}
