import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Pressable, Text } from '@tloncorp/ui';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { View, XStack, YStack, isWeb } from 'tamagui';

import { CHAT_REF_LIKE_MAX_WIDTH } from '../../../constants';
import { useBlockedAuthor } from '../../../hooks/useBlockedAuthor';
import { useChannelContext, useCurrentUserId } from '../../contexts';
import { useCanWrite } from '../../utils/channelUtils';
import AuthorRow from '../AuthorRow';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { DefaultRendererProps } from '../PostContent/BlockRenderer';
import { createContentRenderer } from '../PostContent/ContentRenderer';
import {
  usePostContent,
  usePostLastEditContent,
} from '../PostContent/contentUtils';
import { PostErrorMessage } from '../PostErrorMessage';
import { SentTimeText } from '../SentTimeText';
import { ChatMessageActions } from './ChatMessageActions/Component';
import { ChatMessageDeliveryStatus } from './ChatMessageDeliveryStatus';
import { ChatMessageHighlight } from './ChatMessageHighlight';
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
  onShowEmojiPicker,
  onPressEdit,
  showReplies,
  setViewReactionsPost,
  isHighlighted,
  hideOverflowMenu,
  displayDebugMode = false,
  searchQuery,
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
  onShowEmojiPicker?: (post: db.Post) => void;
  onPressEdit?: (post: db.Post) => void;
  setViewReactionsPost?: (post: db.Post) => void;
  isHighlighted?: boolean;
  displayDebugMode?: boolean;
  hideOverflowMenu?: boolean;
  searchQuery?: string;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const channel = useChannelContext();
  const currentUserId = useCurrentUserId();
  const canWrite = useCanWrite(channel, currentUserId);
  const postActionIds = useMemo(
    () => ChannelAction.channelActionIdsFor({ channel, canWrite }),
    [channel, canWrite]
  );

  const { isAuthorBlocked, showBlockedContent, handleShowAnyway } =
    useBlockedAuthor(post);
  const [showHiddenContent, setShowHiddenContent] = useState(false);

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
    return Boolean(onPress);
  }, [onPress]);

  const handlePress = useCallback(() => {
    onPress?.(post);
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

  const handleRetryPressed = useCallback(async () => {
    try {
      await onPressRetry?.(post);
    } catch (e) {
      console.error('Failed to retry post', e);
    }
  }, [onPressRetry, post]);

  const handleEditPressed = useCallback(() => {
    onPressEdit?.(post);
  }, [post, onPressEdit]);

  const handleEmojiPickerPressed = useCallback(() => {
    onShowEmojiPicker?.(post);
  }, [post, onShowEmojiPicker]);

  const handleHoverIn = useCallback(() => {
    if (isWeb) {
      setIsHovered(true);
    }
  }, []);

  const handleHoverOut = useCallback(() => {
    if (isWeb) {
      setIsHovered(false);
    }
  }, []);

  const content = usePostContent(post);
  const lastEditContent = usePostLastEditContent(post);

  if (!post) {
    return null;
  }

  if (post.isDeleted) {
    return (
      <PostErrorMessage testID="MessageDeleted" message="Message deleted" />
    );
  } else if (post.hidden && !showHiddenContent) {
    return (
      <PostErrorMessage
        testID="MessageHidden"
        message="Message hidden or flagged."
        actionLabel="Show anyway"
        onAction={() => setShowHiddenContent(true)}
      />
    );
  } else if (isAuthorBlocked && !showBlockedContent) {
    return (
      <PostErrorMessage
        testID="MessageBlocked"
        message="Message from a blocked user."
        actionLabel="Show anyway"
        onAction={handleShowAnyway}
        actionTestID="ShowBlockedMessageButton"
      />
    );
  }

  const shouldRenderReplies =
    showReplies && post.replyCount && post.replyTime && post.replyContactIds;

  const shouldRenderReplySummary =
    shouldRenderReplies || (!showAuthor && post.isEdited);

  return (
    <Pressable
      // avoid setting the top level press handler at all unless we need to
      onPress={shouldHandlePress ? handlePress : undefined}
      onLongPress={handleLongPress}
      onHoverIn={handleHoverIn}
      onHoverOut={handleHoverOut}
      pressStyle="unset"
      cursor="default"
      testID="Post"
      borderRadius={'$m'}
      overflow="hidden"
      backgroundColor={
        isWeb && isHovered ? '$secondaryBackground' : 'transparent'
      }
    >
      <YStack key={post.id}>
        {isHighlighted && <ChatMessageHighlight active={isHighlighted} />}
        {showAuthor ? (
          <AuthorRow
            padding="$l"
            paddingBottom="$2xs"
            author={post.author}
            authorId={post.authorId}
            sent={post.sentAt ?? 0}
            type={post.type}
            isBot={post.isBot ?? undefined}
            disabled={hideProfilePreview}
            editStatus={post.editStatus}
            deleteStatus={post.deleteStatus}
            showEditedIndicator={!!post.isEdited}
          />
        ) : null}

        {!hideOverflowMenu && isHovered && !showAuthor && (
          <SentTimeText
            sentAt={post.sentAt}
            color="$tertiaryText"
            position="absolute"
            top={12}
            left={5}
          />
        )}

        {!!post.deliveryStatus && post.deliveryStatus !== 'failed' ? (
          <View
            pointerEvents="none"
            position="absolute"
            right={12}
            top={8}
            zIndex={199}
          >
            <ChatMessageDeliveryStatus status={post.deliveryStatus} />
          </View>
        ) : null}

        <View paddingLeft={!isNotice ? '$4xl' : undefined}>
          {displayDebugMode ? (
            <Text color="$green" size="$body" padding="$xl">
              {JSON.stringify(
                {
                  seq: post.sequenceNum,
                  id: post.id,
                  sentAt: post.sentAt,
                  channelId: post.channelId,
                  authorId: post.authorId,
                  deliveryStatus: post.deliveryStatus,
                  blob: post.blob,
                },
                null,
                2
              )}
            </Text>
          ) : (
            <ChatContentRenderer
              content={post.editStatus === 'failed' ? lastEditContent : content}
              isNotice={post.type === 'notice'}
              onPressImage={handleImagePressed}
              onLongPress={handleLongPress}
              searchQuery={searchQuery}
            />
          )}
        </View>

        {post.reactions && post.reactions.length > 0 && (
          <View paddingBottom="$l" paddingLeft="$4xl">
            <ReactionsDisplay
              post={post}
              onViewPostReactions={setViewReactionsPost}
            />
          </View>
        )}

        {shouldRenderReplySummary || deliveryFailed ? (
          <XStack paddingLeft={'$4xl'} paddingRight="$l" paddingBottom="$l">
            <ChatMessageReplySummary
              post={post}
              onPress={shouldRenderReplies ? handleRepliesPressed : undefined}
              showEditedIndicator={!showAuthor && !!post.isEdited}
              deliveryFailed={deliveryFailed}
              onPressRetry={handleRetryPressed}
            />
          </XStack>
        ) : null}
      </YStack>
      {!hideOverflowMenu && (isHovered || isPopoverOpen) && (
        <View position="absolute" top={showAuthor ? 8 : 2} right={12}>
          <ChatMessageActions
            post={post}
            postActionIds={postActionIds}
            onDismiss={() => {
              setIsPopoverOpen(false);
              setIsHovered(false);
            }}
            onOpenChange={setIsPopoverOpen}
            onReply={handleRepliesPressed}
            onEdit={handleEditPressed}
            onViewReactions={setViewReactionsPost}
            onShowEmojiPicker={handleEmojiPickerPressed}
            trigger={<OverflowTriggerButton testID="MessageActionsTrigger" />}
            mode="await-trigger"
          />
        </View>
      )}
    </Pressable>
  );
};

const WebChatImageRenderer: DefaultRendererProps['image'] = {
  alignItems: 'flex-start',
  imageProps: {
    maxWidth: 600,
    maxHeight: 400,
  },
};

const WebChatVideoRenderer: DefaultRendererProps['video'] = {
  alignItems: 'flex-start',
  maxWidth: 600,
  maxHeight: 400,
};

const ChatContentRenderer = createContentRenderer({
  blockSettings: {
    blockWrapper: {
      paddingLeft: 0,
    },
    reference: {
      contentSize: '$l',
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
    image: isWeb ? WebChatImageRenderer : undefined,
    video: isWeb ? WebChatVideoRenderer : undefined,
    link: {
      renderDescription: true,
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
      imageProps: {
        aspectRatio: 2,
      },
    },
    code: {
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
    file: {
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
    voicememo: {
      maxWidth: CHAT_REF_LIKE_MAX_WIDTH,
    },
  },
});

export default memo(ChatMessage, (prev, next) => {
  const isPostEqual = isEqual(prev.post, next.post);

  const areOtherPropsEqual =
    prev.isHighlighted === next.isHighlighted &&
    prev.showAuthor === next.showAuthor &&
    prev.showReplies === next.showReplies &&
    prev.onPressReplies === next.onPressReplies &&
    prev.onPressImage === next.onPressImage &&
    prev.onLongPress === next.onLongPress &&
    prev.onPress === next.onPress &&
    prev.searchQuery === next.searchQuery &&
    prev.displayDebugMode === next.displayDebugMode;

  return isPostEqual && areOtherPropsEqual;
});
