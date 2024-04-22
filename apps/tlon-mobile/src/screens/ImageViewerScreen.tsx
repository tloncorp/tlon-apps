import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as store from '@tloncorp/shared/dist/store';
import { ImageViewerScreenView } from '@tloncorp/ui';

import type { RootStackParamList } from '../types';

type ImagePreviewScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ImageViewer'
>;

export default function ImageViewerScreen(props: ImagePreviewScreenProps) {
  const postParam = props.route.params.post;
  const uriParam = props.route.params.uri;

  const { data: post } = store.usePostWithRelations({
    id: postParam.id,
  });

  return (
    <ImageViewerScreenView
      post={post}
      uri={uriParam}
      goBack={() => props.navigation.pop()}
    />
  );
}
