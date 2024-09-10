import * as store from '@tloncorp/shared/dist/store';
import { ImageViewerScreenView } from '@tloncorp/ui';

export default function ImageViewerScreen({
  postId,
  uri,
  goBack,
}: {
  postId: string;
  uri: string;
  goBack: () => void;
}) {
  const { data: post } = store.usePostWithRelations({
    id: postId,
  });

  return <ImageViewerScreenView post={post} uri={uri} goBack={goBack} />;
}
