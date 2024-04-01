import { ClientTypes } from '@tloncorp/shared';
import { FlatList } from 'react-native';
import { XStack, YStack } from 'tamagui';

import ChatMessage from '../ChatMessage';

const renderItem = ({ item: post }: { item: ClientTypes.Post }) => (
  <YStack paddingHorizontal="$s" paddingVertical="$m">
    <ChatMessage post={post} />
  </YStack>
);

export default function ChatScroll({ posts }: { posts: ClientTypes.Post[] }) {
  return (
    <XStack padding="$l">
      <FlatList data={posts} renderItem={renderItem} />
    </XStack>
  );
}
