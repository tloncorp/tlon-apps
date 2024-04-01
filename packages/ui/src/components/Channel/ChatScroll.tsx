import { ClientTypes } from '@tloncorp/shared';
import { FlatList, Keyboard } from 'react-native';
import { XStack, YStack } from 'tamagui';

import ChatMessage from '../ChatMessage';

const renderItem = ({ item: post }: { item: ClientTypes.Post }) => (
  <YStack paddingVertical="$m">
    <ChatMessage post={post} />
  </YStack>
);

export default function ChatScroll({ posts }: { posts: ClientTypes.Post[] }) {
  return (
    <XStack flex={1} paddingHorizontal="$m">
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={(post) => post.id}
        keyboardDismissMode="on-drag"
        inverted
      />
    </XStack>
  );
}
