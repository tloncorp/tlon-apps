import * as client from '@tloncorp/shared/dist/client';
import { FlatList } from 'react-native';

import { XStack, YStack } from '../../core';
import ChatMessage from '../ChatMessage';

const renderItem = ({ item: post }: { item: client.Post }) => (
  <YStack paddingVertical="$m">
    <ChatMessage post={post} />
  </YStack>
);

export default function ChatScroll({ posts }: { posts: client.Post[] }) {
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
