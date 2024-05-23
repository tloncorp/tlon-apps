import { makePrettyShortDate, makePrettyTime } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { ScrollView } from 'moti';
import { useCallback, useMemo } from 'react';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { getTokenValue } from 'tamagui';

import { Image, Text, View, XStack, YStack } from '../../core';
import { Avatar } from '../Avatar';
import ChatContent from '../ChatMessage/ChatContent';
import ContactName from '../ContactName';
import Pressable from '../Pressable';

const IMAGE_HEIGHT = 268;

export default function NotebookPost({
  post,
  onPress,
  onLongPress,
  onPressImage,
  detailView = false,
  showReplies = true,
  showAuthor = true,
  smallImage = false,
  smallTitle = false,
}: {
  post: db.Post;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  detailView?: boolean;
  showReplies?: boolean;
  showAuthor?: boolean;
  smallImage?: boolean;
  smallTitle?: boolean;
}) {
  const dateDisplay = useMemo(() => {
    const date = new Date(post.sentAt);

    return makePrettyShortDate(date);
  }, [post.sentAt]);

  const timeDisplay = useMemo(() => {
    const date = new Date(post.sentAt);

    return makePrettyTime(date);
  }, [post.sentAt]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  const handleImagePressed = useCallback(() => {
    if (post.image) {
      onPressImage?.(post, post.image);
    }
  }, [post, onPressImage]);

  if (!post) {
    return null;
  }

  if (detailView) {
    return (
      <ScrollView>
        <YStack key={post.id} gap="$2xl" paddingHorizontal="$xl">
          {post.image && (
            <TouchableOpacity onPress={handleImagePressed} activeOpacity={0.9}>
              <View
                marginHorizontal={-getTokenValue('$2xl')}
                alignItems="center"
              >
                <Image
                  source={{
                    uri: post.image,
                  }}
                  width="100%"
                  height={IMAGE_HEIGHT}
                />
              </View>
            </TouchableOpacity>
          )}
          <YStack gap="$xl">
            {post.title && (
              <Text color="$primaryText" fontSize="$xl">
                {post.title}
              </Text>
            )}
            <Text color="$tertiaryText" fontSize="$l">
              {dateDisplay}
            </Text>
          </YStack>
          {/* TODO: build component for rendering notebook content */}
          <ChatContent post={post} />
        </YStack>
      </ScrollView>
    );
  }

  return (
    <Pressable
      onPress={() => onPress?.(post)}
      onLongPress={handleLongPress}
      delayLongPress={250}
    >
      <YStack key={post.id} gap="$2xl" padding="$m">
        {post.image && (
          <Image
            source={{
              uri: post.image,
            }}
            width="100%"
            height={smallImage ? IMAGE_HEIGHT / 2 : IMAGE_HEIGHT}
            borderRadius="$m"
          />
        )}
        <YStack gap="$xl">
          {post.title && (
            <Text color="$primaryText" fontSize={smallTitle ? '$l' : '$xl'}>
              {post.title}
            </Text>
          )}
          <Text color="$tertiaryText" fontSize={smallTitle ? '$s' : '$l'}>
            {dateDisplay}
          </Text>
        </YStack>
        <XStack gap="$l" alignItems="center" justifyContent="space-between">
          {showAuthor && (
            <XStack gap="$s" alignItems="center">
              <Avatar
                size="$2xl"
                contact={post.author}
                contactId={post.authorId}
              />
              <ContactName showNickname userId={post.authorId} />
              <Text color="$secondaryText" fontSize="$s">
                {timeDisplay}
              </Text>
            </XStack>
          )}
          {showReplies && (
            <XStack
              gap="$s"
              alignItems="center"
              borderRadius="$l"
              borderWidth={1}
              paddingVertical="$m"
              paddingHorizontal="$l"
            >
              <Text color="$primaryText" fontSize="$s">
                {post.replyCount} comments
              </Text>
            </XStack>
          )}
        </XStack>
      </YStack>
    </Pressable>
  );
}
