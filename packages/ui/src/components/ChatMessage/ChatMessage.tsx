import * as db from '@tloncorp/shared/dist/db';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { View, XStack, YStack } from 'tamagui';

import AuthorRow from '../AuthorRow';
import { Icon } from '../Icon';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import { usePostContent } from '../PostContent/contentUtils';
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
  setViewReactionsPost,
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
  setViewReactionsPost?: (post: db.Post) => void;
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

  const content = usePostContent(post);

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
    return <ErrorMessage message="Message deleted" />;
  } else if (post.hidden) {
    return <ErrorMessage message="Message hidden or flagged" />;
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
          deliveryStatus={post.deliveryStatus}
          showEditedIndicator={!!post.isEdited}
        />
      ) : null}
      <View paddingLeft={!isNotice && '$4xl'}>
        <ChatContentRenderer
          content={content}
          isNotice={post.type === 'notice'}
          onPressImage={handleImagePressed}
          onLongPress={handleLongPress}
        />
      </View>

      <ReactionsDisplay
        post={post}
        onViewPostReactions={setViewReactionsPost}
      />

      {shouldRenderReplies ? (
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

const ChatContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      paddingLeft: 0,
    },
    reference: {
      contentSize: '$l',
    },
  },
});

function ErrorMessage({ message }: { message: string }) {
  return (
    <XStack
      gap="$s"
      paddingVertical="$xl"
      justifyContent={'center'}
      alignItems={'center'}
    >
      <Icon size="$s" type="Placeholder" color="$tertiaryText" />
      <Text size="$label/m" color="$tertiaryText">
        {message}
      </Text>
    </XStack>
  );
}

export default memo(ChatMessage, (prev, next) => {
  const isPostEqual = isEqual(prev.post, next.post);

  const areOtherPropsEqual =
    prev.showAuthor === next.showAuthor &&
    prev.showReplies === next.showReplies &&
    prev.onPressReplies === next.onPressReplies &&
    prev.onPressImage === next.onPressImage &&
    prev.onLongPress === next.onLongPress &&
    prev.onPress === next.onPress;

  return isPostEqual && areOtherPropsEqual;
});
