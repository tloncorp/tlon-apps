import * as db from '@tloncorp/shared/dist/db';
import { Story } from '@tloncorp/shared/dist/urbit';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import AuthorRow from '../AuthorRow';
import { Icon } from '../Icon';
import { MessageInput } from '../MessageInput';
import { ContentRenderer } from '../PostContent';
import { SendPostRetrySheet } from '../SendPostRetrySheet';
import { Text } from '../TextV2';
import { ChatMessageReplySummary } from './ChatMessageReplySummary';
import { ReactionsDisplay } from './ReactionsDisplay';

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

  const messageInputForEditing = useMemo(
    () => (
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
    ),
    [post, editPost, setEditingPost]
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

  if (post.isDeleted) {
    return (
      <XStack
        key={post.id}
        gap="$s"
        paddingVertical="$xl"
        justifyContent={'center'}
        alignItems={'center'}
      >
        <Icon size="$s" type="Placeholder" color="$tertiaryText" />
        <Text size="$label/m" color="$tertiaryText">
          Message deleted
        </Text>
      </XStack>
    );
  }

  const shouldRenderReplies =
    showReplies && post.replyCount && post.replyTime && post.replyContactIds;

  return (
    <YStack
      onLongPress={handleLongPress}
      backgroundColor={isHighlighted ? '$secondaryBackground' : undefined}
      key={post.id}
      // avoid setting the top level press handler at all unless we need to
      onPress={shouldHandlePress ? handlePress : undefined}
    >
      {showAuthor ? (
        <AuthorRow
          padding="$l"
          paddingBottom="$2xs"
          author={post.author}
          authorId={post.authorId}
          sent={post.sentAt ?? 0}
          type={post.type}
          disabled={hideProfilePreview}
          showEditedIndicator={!!post.isEdited}
        />
      ) : null}
      <View paddingLeft={!isNotice && '$4xl'}>
        {editing ? (
          messageInputForEditing
        ) : post.hidden ? (
          <Text color="$secondaryText">
            You have hidden or flagged this message.
          </Text>
        ) : (
          <ContentRenderer
            post={post}
            onPressImage={handleImagePressed}
            onLongPress={handleLongPress}
          />
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

      {shouldRenderReplies || post.isEdited ? (
        <XStack paddingLeft={'$4xl'} paddingRight="$l" paddingBottom="$l">
          {shouldRenderReplies ? (
            <ChatMessageReplySummary
              post={post}
              onPress={handleRepliesPressed}
            />
          ) : null}
        </XStack>
      ) : null}
      <SendPostRetrySheet
        open={showRetrySheet}
        onOpenChange={setShowRetrySheet}
        onPressRetry={handleRetryPressed}
        onPressDelete={handleDeletePressed}
      />
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
