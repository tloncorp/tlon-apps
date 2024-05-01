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
  showAuthor,
  onPressReplies,
  onPressImage,
  onLongPress,
  showReplies,
  currentUserId,
}: {
  post: db.Post;
  showAuthor?: boolean;
  showReplies?: boolean;
  currentUserId: string;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
}) => {
  const isNotice = post.type === 'notice';

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
    <YStack key={post.id} gap="$l" paddingVertical="$l">
      {showAuthor ? (
        <View paddingLeft="$l">
          <AuthorRow
            author={post.author}
            authorId={post.authorId}
            sent={post.sentAt ?? 0}
            // roles={roles}
          />
        </View>
      ) : null}
      <View paddingLeft="$4xl">
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
