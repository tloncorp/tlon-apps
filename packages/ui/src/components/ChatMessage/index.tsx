import { PostContent } from '@tloncorp/shared/dist/api';
import * as db from '@tloncorp/shared/dist/db';
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
  onLongPress,
  showReplies,
  showAuthor,
  currentUserId,
}: {
  post: db.Post;
  firstUnread?: string;
  unreadCount?: number;
  showReplies?: boolean;
  showAuthor?: boolean;
  currentUserId: string;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
}) => {
  const isNotice = post.type === 'notice';

  const isUnread = useMemo(
    () => firstUnread && post.id === firstUnread,
    [firstUnread, post.id]
  );

  const content = useMemo(
    () => JSON.parse(post.content as string) as PostContent,
    [post.content]
  );

  const handleRepliesPressed = useCallback(() => {
    onPressReplies?.(post);
  }, [onPressReplies, post]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  const handleImagePressed = useCallback(
    (uri: string) => {
      onPressImage?.(post, uri);
    },
    [onPressImage, post]
  );

  if (!post) {
    return null;
  }

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

  return (
    <YStack key={post.id} onLongPress={handleLongPress}>
      {!isNotice && (
        <>
          {isUnread && !!unreadCount && (
            <YStack alignItems="center">
              <SizableText size="$s" fontWeight="$l">
                {unreadCount} unread messages • &quot;Today&quot;
              </SizableText>
            </YStack>
          )}
        </>
      )}
      {showAuthor ? (
        <View paddingTop="$l" paddingBottom="$xs" paddingLeft="$l">
          <AuthorRow
            author={post.author}
            authorId={post.authorId}
            sent={post.sentAt ?? 0}
            // roles={roles}
          />
        </View>
      ) : null}
      <View paddingLeft="$4xl" paddingVertical="$l" paddingRight="$l">
        {post.hidden ? (
          <SizableText color="$secondaryText">
            You have hidden or flagged this message.
          </SizableText>
        ) : (
          <ChatContent
            story={content}
            isNotice={isNotice}
            onPressImage={handleImagePressed}
            onLongPress={handleLongPress}
            deliveryStatus={post.deliveryStatus}
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
