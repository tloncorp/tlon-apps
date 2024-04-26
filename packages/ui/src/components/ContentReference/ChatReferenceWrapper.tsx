import { PostContent } from '@tloncorp/shared/dist/api';
import { useMemo } from 'react';

import { useNavigation } from '../../contexts';
import { useRequests } from '../../contexts/requests';
import ChatReference from './ChatReference';
import ReferenceSkeleton from './ReferenceSkeleton';

export default function ChatReferenceWrapper({
  channelId,
  postId,
}: {
  channelId: string;
  postId: string;
}) {
  const { usePost, useChannel } = useRequests();
  const { data: post } = usePost({ id: postId });
  const { data: channel } = useChannel({ id: channelId });

  const { navigate } = useNavigation();

  const content = useMemo(
    () => (post ? (JSON.parse(post.content as string) as PostContent) : null),
    [post]
  );

  if (!post || !channel) {
    return <ReferenceSkeleton />;
  }

  return (
    <ChatReference
      post={post}
      channel={channel}
      content={content}
      navigate={navigate}
    />
  );
}
