import { requireNativeViewManager } from 'expo-modules-core';
import { useMemo } from 'react';
import { NativeSyntheticEvent, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from 'tamagui';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { useIsScreenReaderEnabled } from '../../hooks/useIsScreenReaderEnabled';
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
  reactions: NativeMessageMenuReaction[];
  moreReactionsToken?: string;
  presentationKey: string;
  alignment: 'leading' | 'trailing';
  previewBackgroundColor: string;
  onSelect: (event: NativeSyntheticEvent<NativeMessageMenuSelection>) => void;
}

interface NativeMessageMenuReaction {
  value: string;
  selected: boolean;
  token: string;
}

type NativeMessageMenuSelection = {
  kind: 'action' | 'reaction' | 'moreReactions';
  value: string;
  token: string;
};

const NativeMessageContextMenu =
  requireNativeViewManager<NativeMessageContextMenuProps>(
    'TlonMessageContextMenu'
  );

const defaultReactions = ['👍', '❤️', '😂'];
const noop = () => {};
const runImmediately = (action: () => void) => action();

export function MessageContextMenu(props: MessageContextMenuProps) {
  const isScreenReaderEnabled = useIsScreenReaderEnabled();
  if (!props.enabled || isScreenReaderEnabled) {
    return props.children(false);
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
  const { actions, contentKey, performAction } = useMessageActionModel({
    post,
    postActionIds,
    dismiss: noop,
    runAfterDismiss: runImmediately,
    onReply,
    onEdit,
    onViewReactions,
    onViewBotRun,
  });

  const reactionValues = useMemo(() => {
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

  const selectedReaction = reactionDetails.self.didReact
    ? reactionDetails.self.value
    : undefined;
  const reactions = useMemo(
    () =>
      reactionValues.map((value) => ({
        value,
        selected: value === selectedReaction,
        token: JSON.stringify([
          post.id,
          'reaction',
          value,
          selectedReaction,
          canReact,
        ]),
      })),
    [canReact, post.id, reactionValues, selectedReaction]
  );
  const moreReactionsToken = canReact
    ? JSON.stringify([post.id, 'moreReactions'])
    : undefined;
  const alignment = post.authorId === currentUserId ? 'trailing' : 'leading';
  const previewBackgroundColor = theme.secondaryBackground.val;
  const presentationKey = JSON.stringify([
    contentKey,
    actions,
    post.reactions,
    reactions,
    moreReactionsToken,
    alignment,
    previewBackgroundColor,
  ]);

  return (
    <NativeMessageContextMenu
      actions={actions}
      reactions={reactions}
      moreReactionsToken={moreReactionsToken}
      presentationKey={presentationKey}
      alignment={alignment}
      previewBackgroundColor={previewBackgroundColor}
      onSelect={(event) => {
        const { kind, value, token } = event.nativeEvent;
        if (kind === 'action') {
          performAction(value as MessageMenuActionId, token);
        } else if (kind === 'reaction') {
          if (
            reactions.some(
              (reaction) => reaction.value === value && reaction.token === token
            )
          ) {
            onEmojiSelect(value);
          }
        } else if (token === moreReactionsToken) {
          onShowEmojiPicker?.();
        }
      }}
      style={styles.host}
    >
      {children(true)}
    </NativeMessageContextMenu>
  );
}

const styles = StyleSheet.create({
  host: {
    alignSelf: 'stretch',
  },
});
