import { PostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';

import { View, XStack, YStack } from '../../core';
import { Avatar } from '../Avatar';
import ChatContent from '../ChatMessage/ChatContent';
import ContactName from '../ContactName';
import { Icon } from '../Icon';
import Pressable from '../Pressable';

export default function ChatReference({
  channel,
  post,
  content,
  onPress,
}: {
  channel: db.Channel;
  post: db.Post;
  content: PostContent;
  onPress: (channel: db.Channel, post: db.Post) => void;
}) {
  const navigateToChannel = useCallback(() => {
    if (channel && post) {
      onPress(channel, post);
    }
  }, [channel, onPress, post]);

  if (!post) {
    return null;
  }

  return (
    <Pressable onPress={() => navigateToChannel()}>
      <YStack
        borderRadius="$s"
        padding={0}
        marginBottom="$s"
        borderColor="$border"
        borderWidth={1}
      >
        <XStack
          alignItems="center"
          padding="$l"
          justifyContent="space-between"
          borderBottomColor="$border"
          borderBottomWidth={1}
        >
          <XStack>
            <Avatar
              contact={post.author}
              contactId={post.authorId}
              borderRadius="$s"
              marginRight="$s"
            />
            <ContactName color="$tertiaryText" name={post.authorId} showAlias />
          </XStack>
          <Icon type="ArrowRef" color="$tertiaryText" size="$m" />
        </XStack>
        <View padding="$l">
          <ChatContent story={content} />
        </View>
      </YStack>
    </Pressable>
  );
}
