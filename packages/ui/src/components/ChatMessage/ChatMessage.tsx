import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit';
import { memo, useCallback } from 'react';

import { SizableText, View, XStack, YStack } from '../../core';
import AuthorRow from '../AuthorRow';
import ChatContent from '../ContentRenderer';
import { Icon } from '../Icon';
import { MessageInput } from '../MessageInput';
import { ChatMessageReplySummary } from './ChatMessageReplySummary';
import { ReactionsDisplay } from './ReactionsDisplay';

const NoticeWrapper = ({
  isNotice,
  children,
}: {
  isNotice?: boolean;
  children: JSX.Element;
}) => {
  if (isNotice) {
    return (
      <XStack alignItems="center" padding="$l">
        <View width={'$2xl'} flex={1} height={1} backgroundColor="$border" />
        <View
          paddingHorizontal="$m"
          backgroundColor="$border"
          borderRadius={'$2xl'}
        >
          {children}
        </View>
        <View flex={1} height={1} backgroundColor="$border" />
      </XStack>
    );
  }
  return children;
};

const ChatMessage = ({
  post,
  showAuthor,
  onPressReplies,
  onPressImage,
  onLongPress,
  showReplies,
  currentUserId,
  editing,
  editPost,
  setEditingPost,
}: {
  post: db.Post;
  showAuthor?: boolean;
  showReplies?: boolean;
  currentUserId: string;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onLongPress?: (post: db.Post) => void;
  editing?: boolean;
  editPost?: (post: db.Post, content: Story) => void;
  setEditingPost?: (post: db.Post | undefined) => void;
}) => {
  const isNotice = post.type === 'notice';

  if (isNotice) {
    showAuthor = false;
  }

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
    <YStack
      onLongPress={handleLongPress}
      key={post.id}
      gap="$l"
      paddingVertical="$m"
      paddingRight="$l"
    >
      {showAuthor ? (
        <View paddingLeft="$l">
          <AuthorRow
            author={post.author}
            authorId={post.authorId}
            sent={post.sentAt ?? 0}
            type={post.type}
            // roles={roles}
          />
        </View>
      ) : null}
      <View paddingLeft={!isNotice && '$4xl'}>
        {editing ? (
          <MessageInput
            groupMembers={[]}
            storeDraft={() => {}}
            clearDraft={() => {}}
            getDraft={async () => ({})}
            shouldBlur={false}
            setShouldBlur={() => {}}
            send={() => {}}
            channelId={post.channelId}
            editingPost={post}
            editPost={editPost}
            setEditingPost={setEditingPost}
          />
        ) : post.hidden ? (
          <SizableText color="$secondaryText">
            You have hidden or flagged this message.
          </SizableText>
        ) : (
          <NoticeWrapper isNotice={isNotice}>
            <ChatContent
              post={post}
              isNotice={isNotice}
              onPressImage={handleImagePressed}
              onLongPress={handleLongPress}
              deliveryStatus={post.deliveryStatus}
              isEdited={post.isEdited ?? false}
            />
          </NoticeWrapper>
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
