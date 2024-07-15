import { useNavigation } from '../../contexts';
import { useRequests } from '../../contexts/requests';
import { PostViewMode } from '../ContentRenderer';
import ChatReference from './ChatReference';
import ReferenceSkeleton from './ReferenceSkeleton';

export default function ChatReferenceWrapper({
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
        viewMode={viewMode}
      />
    );
  }

  if (!post) {
    if (isLoading) {
      return <ReferenceSkeleton viewMode={viewMode} messageType="loading" />;
    }
    return (
      <ReferenceSkeleton
        viewMode={viewMode}
        messageType="not-found"
        message="This content could not be found"
      />
    );
  }

  return (
    <ChatReference
      post={post}
      channel={channel ?? undefined}
      onPress={onPressRef}
      asAttachment={asAttachment}
      viewMode={viewMode}
    />
  );
}
