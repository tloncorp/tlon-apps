import { useNavigation } from '../../contexts';
import { useRequests } from '../../contexts/requests';
import { PostViewMode } from '../ContentRenderer';
import GalleryReference from './GalleryReference';
import NotebookReference from './NotebookReference';
import ReferenceSkeleton from './ReferenceSkeleton';

export default function GalleryReferenceWrapper({
  channelId,
  postId,
  replyId,
  asAttachment = false,
  viewMode = 'chat',
}: {
  channelId: string;
  postId: string;
  replyId?: string;
  asAttachment?: boolean;
  viewMode?: PostViewMode;
}) {
  const { usePostReference, useChannel } = useRequests();
  const {
    data: post,
    isError,
    error,
    isLoading,
  } = usePostReference({
    postId: replyId ? replyId : postId,
    channelId: channelId,
  });
  const { data: channel } = useChannel({ id: channelId });
  const { onPressRef } = useNavigation();

  if (isError) {
    return (
      <ReferenceSkeleton
        message={error?.message || 'Error loading content'}
        messageType="error"
      />
    );
  }

  if (!post) {
    if (isLoading) {
      return <ReferenceSkeleton messageType="loading" />;
    }
    return (
      <ReferenceSkeleton
        messageType="not-found"
        message="This content could not be found"
      />
    );
  }

  return (
    <GalleryReference
      post={post}
      channel={channel ?? undefined}
      onPress={onPressRef}
      asAttachment={asAttachment}
      viewMode={viewMode}
    />
  );
}
