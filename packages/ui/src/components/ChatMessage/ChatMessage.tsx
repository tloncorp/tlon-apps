import * as db from '@tloncorp/shared/db';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import AuthorRow from '../AuthorRow';
import { Icon } from '../Icon';
import { OverflowMenuButton } from '../OverflowMenuButton';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  usePostContent,
  usePostLastEditContent,
} from '../PostContent/contentUtils';
import Pressable from '../Pressable';
import { SendPostRetrySheet } from '../SendPostRetrySheet';
import { Text } from '../TextV2';
import { ChatMessageDeliveryStatus } from './ChatMessageDeliveryStatus';
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
  hideOverflowMenu,
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
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressDelete?: (post: db.Post) => void;
  setViewReactionsPost?: (post: db.Post) => void;
  isHighlighted?: boolean;
  hideOverflowMenu?: boolean;
}) => {
  const [showRetrySheet, setShowRetrySheet] = useState(false);
  const [showOverflowOnHover, setShowOverflowOnHover] = useState(false);
  const isNotice = post.type === 'notice';

  if (isNotice) {
    showAuthor = false;
  }

  const deliveryFailed =
    post.deliveryStatus === 'failed' ||
    post.editStatus === 'failed' ||
    post.deleteStatus === 'failed';

  const handleRepliesPressed = useCallback(() => {
    onPressReplies?.(post);
  }, [onPressReplies, post]);

  const shouldHandlePress = useMemo(() => {
    return Boolean(onPress || deliveryFailed);
  }, [onPress, deliveryFailed]);

  const handlePress = useCallback(() => {
    if (onPress && !deliveryFailed) {
      onPress(post);
    } else if (deliveryFailed) {
      setShowRetrySheet(true);
    }
  }, [post, onPress, deliveryFailed]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(post);
  }, [post, onLongPress]);

  const handleImagePressed = useCallback(
    (uri: string) => {
      onPressImage?.(post, uri);
    },
    [onPressImage, post]
  );

  const handleRetryPressed = useCallback(async () => {
    try {
      await onPressRetry?.(post);
    } catch (e) {
      console.error('Failed to retry post', e);
    }
    setShowRetrySheet(false);
  }, [onPressRetry, post]);

  const handleDeletePressed = useCallback(() => {
    onPressDelete?.(post);
    setShowRetrySheet(false);
  }, [onPressDelete, post]);

  const handleHoverIn = useCallback(() => {
    if (isWeb) {
      setShowOverflowOnHover(true);
    }
  }, []);

  const handleHoverOut = useCallback(() => {
    if (isWeb) {
      setShowOverflowOnHover(false);
    }
  }, []);

  const content = usePostContent(post);
  const lastEditContent = usePostLastEditContent(post);

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
    <Pressable
      // avoid setting the top level press handler at all unless we need to
      onPress={shouldHandlePress ? handlePress : undefined}
      onLongPress={handleLongPress}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
    >
      <YStack
        backgroundColor={isHighlighted ? '$secondaryBackground' : undefined}
        key={post.id}
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
            editStatus={post.editStatus}
            deleteStatus={post.deleteStatus}
            showEditedIndicator={!!post.isEdited}
          />
        ) : null}
        <View paddingLeft={!isNotice && '$4xl'}>
          <ChatContentRenderer
            content={post.editStatus === 'failed' ? lastEditContent : content}
            isNotice={post.type === 'notice'}
            onPressImage={handleImagePressed}
          />
        </View>

        {/** we need to show delivery status even if showAuthor is false
           previously we were only showing delivery status if showAuthor was true
           (i.e., on the first of a series of messages)
        */}
        {!showAuthor &&
        !!post.deliveryStatus &&
        post.deliveryStatus !== 'failed' ? (
          <View position="absolute" right={12} top={8}>
            <ChatMessageDeliveryStatus status={post.deliveryStatus} />
          </View>
        ) : null}

        {!showAuthor && deliveryFailed ? (
          <View position="absolute" right={12} top={8}>
            <Text size="$label/m" color="$negativeActionText">
              Tap to retry
            </Text>
          </View>
        ) : null}

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
          post={post}
          onOpenChange={setShowRetrySheet}
          onPressRetry={handleRetryPressed}
          onPressDelete={handleDeletePressed}
        />
      </YStack>
      {!hideOverflowMenu && showOverflowOnHover && (
        <OverflowMenuButton
          onPress={handleLongPress}
          top={0}
          right={12}
          width={0}
        />
      )}
    </Pressable>
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
    image: {
      alignItems: 'flex-start',
      imageProps: {
        maxWidth: 600,
        maxHeight: 600,
        height: 'auto',
        width: 'auto',
        objectFit: 'contain',
      },
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
