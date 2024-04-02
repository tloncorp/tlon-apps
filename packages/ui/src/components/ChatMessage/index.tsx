import * as client from '@tloncorp/shared/dist/client';
import { Story } from '@tloncorp/shared/dist/urbit/channel';
import { memo, useMemo } from 'react';
import { View, YStack } from '../../core';

import AuthorRow from './AuthorRow';
import ChatContent from './ChatContent';

const ChatMessage = memo(({ post }: { post: client.Post | null }) => {
  if (!post) {
    return null;
  }

  const content = useMemo(
    () => JSON.parse(post.content) as Story,
    [post.content]
  );
  const roles = useMemo(
    () => post.group?.members?.find((m) => m.id === post.author.id)?.roles,
    [post.group, post.author]
  );

  return (
    <YStack key={post.id} gap="$l">
      <View paddingLeft="$l">
        <AuthorRow author={post.author} sent={post.sentAt} roles={roles} />
      </View>
      <View paddingLeft="$4xl">
        <ChatContent story={content} />
      </View>
    </YStack>
  );
});

export default ChatMessage;
