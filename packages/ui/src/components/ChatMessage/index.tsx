import * as client from '@tloncorp/shared/dist/client';
import { Story } from '@tloncorp/shared/dist/urbit/channel';
import { SizableText, View, YStack } from 'tamagui';

import AuthorRow from './AuthorRow';
import ChatContent from './ChatContent';

export default function ChatMessage({
  post,
}: {
  post: client.Post | null;
}) {
  if (!post) {
    return null;
  }

  const content = JSON.parse(post.content) as Story;
  const roles = post.group?.members?.find(
    (m) => m.id === post.author.id
  )?.roles;

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
}
