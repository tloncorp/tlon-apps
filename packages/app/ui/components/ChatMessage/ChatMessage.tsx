import * as api from '@tloncorp/api';
import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Pressable } from '@tloncorp/ui';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { View, isWeb } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useChannelContext } from '../../contexts/channel';
import type { A2UIActionCompletion } from '../../contexts/componentsKits';
import { useCanWrite } from '../../utils/channelUtils';
import AuthorRow from '../AuthorRow';
import { getOwnContextLensStamp } from '../Channel/ContextLens/lensPost';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { MaskedChatMessage } from '../PostModeration';
import { BotFeedbackRow } from './BotFeedbackRow';
import { ChatMessageActions } from './ChatMessageActions/Component';
import { MessageContextMenu } from './MessageContextMenu';
import { StaticChatMessage } from './StaticChatMessage';

/**
 * Wraps
 * [`StaticChatMessage`](packages/app/ui/components/ChatMessage/StaticChatMessage.tsx)
 * with press behavior, moderation (deleted/hidden/blocked) handling, and an
 * overflow menu with actions.
 */
const ChatMessage = ({
  post,
  a2uiActionCompletion,
  showAuthor,
  hideProfilePreview,
  onPressReplies,
  onPressImage,
  onPress,
  onLongPress,
  onPressRetry,
  onPressBotRun,
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
  a2uiActionCompletion?: A2UIActionCompletion;
  showAuthor?: boolean;
  hideProfilePreview?: boolean;
  authorRowProps?: Partial<ComponentProps<typeof AuthorRow>>;
  showReplies?: boolean;
  onPressReplies?: (post: db.Post) => void;
  onPressImage?: (post: db.Post, imageUri?: string) => void;
  onPress?: (post: db.Post) => void;
  onLongPress?: (post: db.Post) => void;
  onPressRetry?: (post: db.Post) => Promise<void>;
  onPressBotRun?: (post: db.Post) => void;
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
  // Rating feedback is only supported for the user's Tlon-hosted bot, but
  // lens-stamped posts from any owned bot ship (e.g. self-hosted bots) still
  // get the row for the Context Lens action.
  const isOwnTlonBotReply =
    (post.type === 'chat' || post.type === 'reply') &&
    api.isBotUserIdForUser(post.authorId, currentUserId);
  const { data: ownedBotShips } = store.useContextLensBotShips();
  const hasOwnLensStamp = useMemo(
    () => Boolean(getOwnContextLensStamp(post, ownedBotShips ?? [])),
    [post, ownedBotShips]
  );
  const showBotFeedback =
    isOwnTlonBotReply || (hasOwnLensStamp && !!onPressBotRun);
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

  return (
    <MaskedChatMessage post={post}>
      <MessageContextMenu
        enabled={Boolean(onLongPress) && post.type !== 'notice'}
        previewKey={JSON.stringify([
          showAuthor,
          showReplies,
          isHighlighted,
          displayDebugMode,
          searchQuery,
        ])}
        post={post}
        postActionIds={postActionIds}
        canReact={canWrite}
        onReply={handleRepliesPressed}
        onEdit={handleEditPressed}
        onViewReactions={setViewReactionsPost}
        onViewBotRun={onPressBotRun}
        onShowEmojiPicker={handleEmojiPickerPressed}
      >
        {(usesNativeContextMenu) => (
          <Pressable
            onPress={shouldHandlePress ? handlePress : undefined}
            onLongPress={usesNativeContextMenu ? undefined : handleLongPress}
            onMouseEnter={handleHoverIn}
            onMouseLeave={handleHoverOut}
            pressStyle={{}}
            cursor="default"
            testID="Post"
            borderRadius={'$m'}
            overflow="hidden"
            backgroundColor={
              isWeb && isHovered ? '$secondaryBackground' : 'transparent'
            }
          >
            <StaticChatMessage
              {...{
                displayDebugMode,
                hideProfilePreview,
                hideSentAtTimestamp: hideOverflowMenu || !isHovered,
                isHighlighted,
                onLongPress: usesNativeContextMenu ? undefined : onLongPress,
                onPressImage,
                onPressReplies,
                onPressRetry,
                post,
                a2uiActionCompletion,
                searchQuery,
                setViewReactionsPost,
                showAuthor,
                showReplies,
                feedbackRow: showBotFeedback
                  ? ({ inline }: { inline: boolean }) => (
                      <BotFeedbackRow
                        post={post}
                        currentUserId={currentUserId}
                        onPressBotRun={onPressBotRun}
                        // Controls sharing a row with reactions or the reply
                        // summary reveal on hover (web-only slots); the
                        // standalone row is always visible.
                        visible={!inline || isHovered}
                      />
                    )
                  : undefined,
              }}
            />
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
                  onViewBotRun={onPressBotRun}
                  onShowEmojiPicker={handleEmojiPickerPressed}
                  trigger={
                    <OverflowTriggerButton testID="MessageActionsTrigger" />
                  }
                  mode="await-trigger"
                />
              </View>
            )}
          </Pressable>
        )}
      </MessageContextMenu>
    </MaskedChatMessage>
  );
};

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
    prev.onPressBotRun === next.onPressBotRun &&
    isEqual(prev.a2uiActionCompletion, next.a2uiActionCompletion) &&
    prev.searchQuery === next.searchQuery &&
    prev.displayDebugMode === next.displayDebugMode;

  return isPostEqual && areOtherPropsEqual;
});
