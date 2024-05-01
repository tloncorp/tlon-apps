import { makePrettyShortDate, makePrettyTime } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { useMemo } from 'react';

import { Image, Text, XStack, YStack } from '../../core';
import { Avatar } from '../Avatar';
import { ReactionsDisplay } from '../ChatMessage/ReactionsDisplay';
import ContactName from '../ContactName';
import Pressable from '../Pressable';

const IMAGE_HEIGHT = 268;

export default function NotebookPost({
  post,
  firstUnread,
  unreadCount,
  onPress,
  onLongPress,
  currentUserId,
  // TODO: handle expanded version (w/full content?)
  // In general, there are a lot of boolean props here that I *think*
  // could be handled by making a separate component for headline vs full post
  expanded = false,
  showReactions,
  showReplies = true,
  showAuthorRow = true,
  smallImage = false,
  smallTitle = false,
}: {
  post: db.Post;
  firstUnread?: string;
  unreadCount?: number;
  showReplies?: boolean;
  currentUserId: string;
  onPress?: () => void;
  onLongPress?: () => void;
  expanded?: boolean;
  showReactions?: boolean;
  showAuthorRow?: boolean;
  smallImage?: boolean;
  smallTitle?: boolean;
}) {
  const isUnread = useMemo(
    () => firstUnread && post.id === firstUnread,
    [firstUnread, post.id]
  );

  const dateDisplay = useMemo(() => {
    const date = new Date(post.sentAt);

    return makePrettyShortDate(date);
  }, [post.sentAt]);

  const timeDisplay = useMemo(() => {
    const date = new Date(post.sentAt);

    return makePrettyTime(date);
  }, [post.sentAt]);

  if (!post) {
    return null;
  }

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={250}>
      <YStack key={post.id} gap="$2xl" padding="$m">
        {isUnread && !!unreadCount && (
          <YStack alignItems="center">
            <Text fontSize="$s" fontWeight="$l">
              {unreadCount} unread post • &quot;Today&quot;
            </Text>
          </YStack>
        )}
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
          {showAuthorRow && (
            <XStack gap="$s" alignItems="center">
              <Avatar
                size="$2xl"
                contact={post.author}
                contactId={post.authorId}
              />
              <ContactName showAlias name={post.authorId} />
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
        {showReactions && (
          <ReactionsDisplay post={post} currentUserId={currentUserId} />
        )}
      </YStack>
    </Pressable>
  );
}
