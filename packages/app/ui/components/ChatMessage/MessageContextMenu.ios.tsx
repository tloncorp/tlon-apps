import * as db from '@tloncorp/shared/db';
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
import {
  resolveReactionSlot,
  selectFrequentEmojis,
  selectLastReactionSlot,
} from './ChatMessageActions/quickEmojis';
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
  previewKey,
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
  const emojiUsage = db.emojiUsage.useValue();
  const frequentReactions = useMemo(
    () => selectFrequentEmojis(db.sortEmojisByUsage(emojiUsage)),
    [emojiUsage]
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

  const selectedReaction = reactionDetails.self.didReact
    ? reactionDetails.self.value
    : undefined;
  const reactionSlots = useMemo(() => {
    if (!canReact) {
      return [];
    }
    const lastReaction = selectLastReactionSlot(
      frequentReactions,
      selectedReaction
    );
    return [...frequentReactions, lastReaction].map((slot) => {
      const reaction = resolveReactionSlot(slot, selectedReaction);
      return {
        ...reaction,
        token: JSON.stringify([
          post.id,
          'reaction',
          reaction.value,
          reaction.actionValue,
          selectedReaction,
          canReact,
        ]),
      };
    });
  }, [canReact, frequentReactions, post.id, selectedReaction]);
  const reactions = useMemo<NativeMessageMenuReaction[]>(
    () =>
      reactionSlots.map(
        ({ actionValue: _actionValue, ...reaction }) => reaction
      ),
    [reactionSlots]
  );
  const moreReactionsToken = canReact
    ? JSON.stringify([post.id, 'moreReactions'])
    : undefined;
  const alignment = post.authorId === currentUserId ? 'trailing' : 'leading';
  const previewBackgroundColor = theme.secondaryBackground.val;
  const presentationKey = JSON.stringify([
    previewKey,
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
          const reaction = reactionSlots.find(
            (candidate) =>
              candidate.value === value && candidate.token === token
          );
          if (reaction) {
            onEmojiSelect(reaction.actionValue);
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
