import { requireNativeViewManager } from 'expo-modules-core';
import { useMemo } from 'react';
import { NativeSyntheticEvent, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import useOnEmojiSelect from '../../hooks/useOnEmojiSelect';
import { useReactionDetails } from '../../utils/postUtils';
import {
  MessageMenuActionDescriptor,
  MessageMenuActionId,
  useMessageActionModel,
} from './ChatMessageActions/MessageActions';
import { MessageContextMenuProps } from './MessageContextMenu.types';

interface NativeMessageContextMenuProps extends ViewProps {
  actions: MessageMenuActionDescriptor[];
  reactions: string[];
  selectedReaction?: string;
  contentKey: string;
  alignment: 'leading' | 'trailing';
  previewBackgroundColor: string;
  onAction: (event: NativeSyntheticEvent<{ id: MessageMenuActionId }>) => void;
  onReaction: (event: NativeSyntheticEvent<{ value: string }>) => void;
  onMoreReactions?: () => void;
}

const NativeMessageContextMenu =
  requireNativeViewManager<NativeMessageContextMenuProps>(
    'TlonMessageContextMenu'
  );

const defaultReactions = ['👍', '❤️', '😂'];
const noop = () => {};
const runImmediately = (action: () => void) => action();

export function MessageContextMenu(props: MessageContextMenuProps) {
  if (!props.enabled) {
    return props.children;
  }

  return <EnabledMessageContextMenu {...props} />;
}

function EnabledMessageContextMenu({
  children,
  post,
  postActionIds,
  canReact,
  onReply,
  onEdit,
  onViewReactions,
  onViewBotRun,
  onShowEmojiPicker,
}: MessageContextMenuProps) {
  const theme = useTheme();
  const currentUserId = useCurrentUserId();
  const reactionDetails = useReactionDetails(
    post.reactions ?? [],
    currentUserId
  );
  const onEmojiSelect = useOnEmojiSelect(post, noop);
  const { actions, performAction } = useMessageActionModel({
    post,
    postActionIds,
    dismiss: noop,
    runAfterDismiss: runImmediately,
    onReply,
    onEdit,
    onViewReactions,
    onViewBotRun,
  });

  const reactions = useMemo(() => {
    if (!canReact) {
      return [];
    }
    const ownReaction = reactionDetails.self.value;
    const lastReaction =
      reactionDetails.self.didReact &&
      ![...defaultReactions, '🌀'].includes(ownReaction)
        ? ownReaction
        : '🌀';
    return [...defaultReactions, lastReaction];
  }, [canReact, reactionDetails.self.didReact, reactionDetails.self.value]);

  return (
    <NativeMessageContextMenu
      actions={actions}
      reactions={reactions}
      selectedReaction={
        reactionDetails.self.didReact ? reactionDetails.self.value : undefined
      }
      contentKey={JSON.stringify([
        post.content,
        post.textContent,
        post.title,
        post.image,
        post.description,
        post.cover,
        post.isDeleted,
        post.reactions,
      ])}
      alignment={post.authorId === currentUserId ? 'trailing' : 'leading'}
      previewBackgroundColor={theme.secondaryBackground.val}
      onAction={(event) => performAction(event.nativeEvent.id)}
      onReaction={(event) => onEmojiSelect(event.nativeEvent.value)}
      onMoreReactions={onShowEmojiPicker}
      style={styles.host}
    >
      {children}
    </NativeMessageContextMenu>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'stretch',
  },
});
