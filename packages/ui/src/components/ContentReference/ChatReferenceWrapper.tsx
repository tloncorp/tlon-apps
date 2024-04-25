import { useChannel, usePostWithRelations } from '@tloncorp/shared/dist';
import { PostContent } from '@tloncorp/shared/dist/api';
import { useMemo } from 'react';

import { useNavigation } from '../../contexts';
import ChatReference from './ChatReference';

export default function ChatReferenceWrapper({
  channelId,
  postId,
}: {
  channelId: string;
  postId: string;
}) {
  const { data: post } = usePostWithRelations({ id: postId });
  const { data: channel } = useChannel({ id: channelId });

  const { navigate } = useNavigation();

  const content = useMemo(
    () => (post ? (JSON.parse(post.content as string) as PostContent) : null),
    [post]
  );

  if (!post || !channel) {
    return null;
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
