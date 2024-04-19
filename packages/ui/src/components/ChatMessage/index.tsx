import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit/channel';
import { memo, useCallback, useMemo } from 'react';

import { SizableText, View, YStack } from '../../core';
import AuthorRow from './AuthorRow';
import ChatContent from './ChatContent';
import { ChatMessageReplySummary } from './ChatMessageReplySummary';
import { ReactionsDisplay } from './ReactionsDisplay';

const ChatMessage = ({
  post,
  firstUnread,
  unreadCount,
  onPressReplies,
  onPressImage,
  showReplies,
  currentUserId,
}: {
  post: db.PostWithRelations | db.PostInsertWithAuthor;
  firstUnread?: string;
  unreadCount?: number;
  showReplies?: boolean;
  currentUserId: string;
  onPressReplies?: (post: db.PostInsert) => void;
  onPressImage?: (post: db.PostInsert, imageUri?: string) => void;
}) => {
  if (!post) {
    return null;
  }

  const isUnread = useMemo(
    () => firstUnread && post.id === firstUnread,
    [firstUnread, post.id]
  );

  const content = useMemo(
    () => JSON.parse(post.content as string) as Story,
    [post.content]
  );
  // const roles = useMemo(
  // () =>
  // group.members
  // ?.find((m) => m.contactId === post.author.id)
  // ?.roles.map((r) => r.roleId),
  // [group, post.author]
  // );

  // const prettyDay = useMemo(() => {
  // const date = new Date(post.sentAt ?? '');
  // return utils.makePrettyDay(date);
  // }, [post.sentAt]);

  const handleRepliesPressed = useCallback(() => {
    onPressReplies?.(post);
  }, [onPressReplies]);

  return (
    <YStack key={post.id} gap="$l">
      <YStack alignItems="center">
        {isUnread && unreadCount && (
          <SizableText size="$s" fontWeight="$l">
            {unreadCount} unread messages • "Today"
          </SizableText>
        )}
      </YStack>
      <View paddingLeft="$l">
        <AuthorRow
          author={post.author}
          authorId={post.authorId}
          sent={post.sentAt ?? 0}
          // roles={roles}
        />
      </View>
      <View paddingLeft="$4xl">
        {post.hidden ? (
          <SizableText color="$secondaryText">
            You have hidden or flagged this message.
          </SizableText>
        ) : (
          <ChatContent
            story={content}
            onPressImage={
              onPressImage
                ? (uri?: string) => onPressImage(post, uri)
                : undefined
            }
          />
        )}
      </View>
      <ReactionsDisplay post={post} currentUserId={currentUserId} />

      {showReplies &&
      post.replyCount &&
      post.replyTime &&
      post.replyContactIds ? (
        <ChatMessageReplySummary
          onPress={handleRepliesPressed}
          replyCount={post.replyCount}
          replyTime={post.replyTime}
          replyContactIds={post.replyContactIds}
        />
      ) : null}
    </YStack>
  );
};

export default memo(ChatMessage);
