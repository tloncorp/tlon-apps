import { ClientTypes } from '@tloncorp/shared';
import { Story } from '@tloncorp/shared/dist/urbit/channel';
import { SizableText, YStack } from 'tamagui';

import AuthorRow from './AuthorRow';
import ChatContent from './ChatContent';

export default function ChatMessage({
  post,
}: {
  post: ClientTypes.Post | null;
}) {
  if (!post) {
    return null;
  }

  const content = JSON.parse(post.content) as Story;

  return (
    <YStack key={post.id} gap="$space.xs">
      <AuthorRow author={post.author} sent={post.sentAt} />
      <SizableText size={'$m'}>
        <ChatContent story={content} />
      </SizableText>
    </YStack>
  );
}
