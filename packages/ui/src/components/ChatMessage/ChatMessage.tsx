import { utils } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';

import { Text, View, XStack, YStack } from '../../core';
import { ActionSheet } from '../ActionSheet';
import AuthorRow from '../AuthorRow';
import { Button } from '../Button';
import ContentRenderer from '../ContentRenderer';
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
  hideProfilePreview,
  onPressReplies,
  onPressImage,
  onPress,
  onLongPress,
  onPressRetry,
  onPressDelete,
  showReplies,
  editing,
  editPost,
  setEditingPost,
  isHighlighted,
}: {
  post: db.Post;
  showAuthor?: boolean;
  hideProfilePreview?: boolean;
  authorRowProps?: Partial<ComponentProps<typeof AuthorRow>>;
  showReplies?: boolean;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => void;
  onPressDelete?: (post: db.Post) => void;
  editing?: boolean;
  editPost?: (post: db.Post, content: Story) => Promise<void>;
  setEditingPost?: (post: db.Post | undefined) => void;
  isHighlighted?: boolean;
}) => {
  const [showRetrySheet, setShowRetrySheet] = useState(false);
  const isNotice = post.type === 'notice';

  if (isNotice) {
    showAuthor = false;
  }

  const handleRepliesPressed = useCallback(() => {
    onPressReplies?.(post);
  }, [onPressReplies, post]);

  const shouldHandlePress = useMemo(() => {
    return Boolean(onPress || post.deliveryStatus === 'failed');
  }, [onPress, post.deliveryStatus]);
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress(post);
    } else if (post.deliveryStatus === 'failed') {
      setShowRetrySheet(true);
    }
  }, [post, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  const handleImagePressed = useCallback(
    (uri: string) => {
      onPressImage?.(post, uri);
    },
    [onPressImage, post]
  );

  const handleRetryPressed = useCallback(() => {
    onPressRetry?.(post);
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const timeDisplay = useMemo(() => {
    const date = new Date(post.sentAt ?? 0);
    return utils.makePrettyTime(date);
  }, [post.sentAt]);

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

  if (post.isDeleted) {
    return (
      <XStack
        alignItems="center"
        key={post.id}
        gap="$s"
        paddingVertical="$m"
        paddingRight="$l"
        marginVertical="$s"
        backgroundColor="$secondaryBackground"
        borderRadius="$xl"
        overflow="hidden"
      >
        <Text
          paddingLeft="$l"
          fontSize="$s"
          fontWeight="$l"
          color="$secondaryText"
        >
          {timeDisplay}
        </Text>
        <Text fontStyle="italic" paddingLeft="$4xl" color="$secondaryText">
          This message was deleted
        </Text>
      </XStack>
    );
  }

  return (
    <YStack
      onLongPress={handleLongPress}
      backgroundColor={isHighlighted ? '$secondaryBackground' : undefined}
      key={post.id}
      gap="$s"
      paddingVertical="$xs"
      paddingRight="$l"
      // avoid setting the top level press handler at all unless we need to
      onPress={shouldHandlePress ? handlePress : undefined}
    >
      {showAuthor ? (
        <View paddingLeft="$l" paddingTop="$s">
          <AuthorRow
            author={post.author}
            authorId={post.authorId}
            sent={post.sentAt ?? 0}
            type={post.type}
            disabled={hideProfilePreview}
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
            send={async () => {}}
            channelId={post.channelId}
            editingPost={post}
            editPost={editPost}
            setEditingPost={setEditingPost}
            channelType="chat"
          />
        ) : post.hidden ? (
          <Text color="$secondaryText">
            You have hidden or flagged this message.
          </Text>
        ) : (
          <NoticeWrapper isNotice={isNotice}>
            <ContentRenderer
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
      {post.deliveryStatus === 'failed' ? (
        <XStack alignItems="center" justifyContent="flex-end">
          <Text color="$negativeActionText" fontSize="$xs">
            Message failed to send
          </Text>
        </XStack>
      ) : null}
      <ReactionsDisplay post={post} />

      {showReplies &&
      post.replyCount &&
      post.replyTime &&
      post.replyContactIds ? (
        <ChatMessageReplySummary post={post} onPress={handleRepliesPressed} />
      ) : null}
      <ActionSheet open={showRetrySheet} onOpenChange={setShowRetrySheet}>
        <ActionSheet.ActionTitle>Post failed to send</ActionSheet.ActionTitle>
        <Button hero onPress={handleRetryPressed}>
          <Button.Text>Retry</Button.Text>
        </Button>
        <Button heroDestructive onPress={handleDeletePressed}>
          <Button.Text>Delete</Button.Text>
        </Button>
      </ActionSheet>
    </YStack>
  );
};

export default memo(ChatMessage, (prev, next) => {
  const isPostEqual = isEqual(prev.post, next.post);

  const areOtherPropsEqual =
    prev.showAuthor === next.showAuthor &&
    prev.showReplies === next.showReplies &&
    prev.editing === next.editing &&
    prev.editPost === next.editPost &&
    prev.setEditingPost === next.setEditingPost &&
    prev.onPressReplies === next.onPressReplies &&
    prev.onPressImage === next.onPressImage &&
    prev.onLongPress === next.onLongPress &&
    prev.onPress === next.onPress;

  return isPostEqual && areOtherPropsEqual;
});
