import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Pressable } from '@tloncorp/ui';
import { isEqual } from 'lodash';
import { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { View, isWeb } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useChannelContext } from '../../contexts/channel';
import { useCanWrite } from '../../utils/channelUtils';
import AuthorRow from '../AuthorRow';
import { OverflowTriggerButton } from '../OverflowMenuButton';
import { MaskedChatMessage } from '../PostModeration';
import { ChatMessageActions } from './ChatMessageActions/Component';
import { StaticChatMessage } from './StaticChatMessage';

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
        <StaticChatMessage
          {...{
            displayDebugMode,
            hideProfilePreview,
            hideSentAtTimestamp: hideOverflowMenu || !isHovered,
            isHighlighted,
            onLongPress,
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
              onShowEmojiPicker={handleEmojiPickerPressed}
              trigger={<OverflowTriggerButton testID="MessageActionsTrigger" />}
              mode="await-trigger"
            />
          </View>
        )}
      </Pressable>
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
    prev.searchQuery === next.searchQuery &&
    prev.displayDebugMode === next.displayDebugMode;

  return isPostEqual && areOtherPropsEqual;
});
