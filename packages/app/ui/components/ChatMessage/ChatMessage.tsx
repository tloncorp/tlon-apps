import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Pressable } from '@tloncorp/ui';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { View, isWeb } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useChannelContext } from '../../contexts/channel';
import { useIsScreenReaderEnabled } from '../../hooks/useIsScreenReaderEnabled';
import { useCanWrite } from '../../utils/channelUtils';
import AuthorRow from '../AuthorRow';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { MaskedChatMessage } from '../PostModeration';
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

  // VoiceOver intercepts touches before they reach the native menu's long-press
  // recognizer, which would leave message actions unreachable. Fall back to the
  // JS action sheet - the same path Android and web already use - so the
  // actions stay available.
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  const usesNativeContextMenu = Platform.OS === 'ios' && !isScreenReaderEnabled;

  return (
    <MaskedChatMessage post={post}>
      <MessageContextMenu
        enabled={Boolean(onLongPress) && usesNativeContextMenu}
        post={post}
        postActionIds={postActionIds}
        canReact={canWrite}
        onReply={handleRepliesPressed}
        onEdit={handleEditPressed}
        onViewReactions={setViewReactionsPost}
        onViewBotRun={onPressBotRun}
        onShowEmojiPicker={handleEmojiPickerPressed}
      >
        <Pressable
          // iOS long presses are owned by the native context-menu host, except
          // under a screen reader - see `usesNativeContextMenu`.
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
              onPressBotRun,
              onPressImage,
              onPressReplies,
              onPressRetry,
              post,
              searchQuery,
              setViewReactionsPost,
              showAuthor,
              showReplies,
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
    prev.searchQuery === next.searchQuery &&
    prev.displayDebugMode === next.displayDebugMode;

  return isPostEqual && areOtherPropsEqual;
});
