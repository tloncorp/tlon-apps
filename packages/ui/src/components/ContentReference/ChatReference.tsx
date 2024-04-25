import { PostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { TouchableOpacity } from 'react-native';

import { View, XStack, YStack } from '../../core';
import { Avatar } from '../Avatar';
import ChatContent from '../ChatMessage/ChatContent';
import ContactName from '../ContactName';
import { Icon } from '../Icon';

export default function ChatReference({
  channel,
  post,
  content,
  navigate,
}: {
  channel: db.Channel;
  post: db.PostWithRelations;
  content: PostContent;
  navigate: (channel: db.Channel, post: db.PostWithRelations) => void;
}) {
  const navigateToChannel = useCallback(() => {
    if (channel && post) {
      navigate(channel, post);
    }
  }, [channel, navigate, post]);

  if (!post) {
    return null;
  }

  return (
    <TouchableOpacity onPress={() => navigateToChannel()}>
      <YStack
        borderRadius="$s"
        padding="$s"
        marginBottom="$s"
        borderColor="$border"
        borderWidth={1}
      >
        <XStack
          alignItems="center"
          paddingBottom="$s"
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
        <View>
          <ChatContent story={content} />
        </View>
      </YStack>
    </TouchableOpacity>
  );
}
