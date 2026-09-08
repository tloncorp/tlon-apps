import type * as db from '@tloncorp/shared/db';
import { Modal } from '@tloncorp/ui';
import React, { createRef, useCallback, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { View as RNView } from 'react-native';

import useOnEmojiSelect from '../../hooks/useOnEmojiSelect';
import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';
import { ViewReactionsSheet } from '../ChatMessage/ViewReactionsSheet';
import { EmojiPickerSheet } from '../Emoji';
import { ContextLensRunSheet } from './ContextLens/ContextLensRunSheet';

/** Message actions keep their local sheets and measured row ref together.
 * The selected message and editing state remain owned by the caller. */
export function useScrollerMessageActions({
  activeMessage,
  setActiveMessage,
  setEditingPost,
  onOpenContextLens,
}: {
  activeMessage: db.Post | null;
  setActiveMessage: (post: db.Post | null) => void;
  setEditingPost?: (post: db.Post | undefined) => void;
  onOpenContextLens?: (post: db.Post) => void;
}) {
  const [viewReactionsPost, setViewReactionsPost] = useState<db.Post | null>(
    null
  );
  const [viewBotRunPost, setViewBotRunPost] = useState<db.Post | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const messageRefs = useRef<Record<string, RefObject<RNView | null>>>({});
  const refFor = useCallback(
    (postId: string) => messageRefs.current[postId],
    []
  );

  const onLongPressPost = useCallback(
    (post: db.Post) => {
      if (post.type !== 'notice') {
        messageRefs.current = { [post.id]: createRef() };
        setActiveMessage(post);
      }
    },
    [setActiveMessage]
  );

  const onShowEmojiPicker = useCallback(
    (post: db.Post) => {
      setActiveMessage(post);
      setEmojiPickerOpen(true);
    },
    [setActiveMessage]
  );

  const onPressEdit = useCallback(
    (post: db.Post) => {
      setEditingPost?.(post);
      setActiveMessage(null);
    },
    [setActiveMessage, setEditingPost]
  );

  const onPressBotRun = useCallback(
    (post: db.Post) => {
      if (onOpenContextLens) {
        onOpenContextLens(post);
        return;
      }
      setViewBotRunPost(post);
    },
    [onOpenContextLens]
  );

  const onEmojiSelect = useOnEmojiSelect(activeMessage, () =>
    setEmojiPickerOpen(false)
  );

  return {
    activeMessage,
    refFor,
    onLongPressPost,
    onShowEmojiPicker,
    onPressEdit,
    onPressBotRun,
    setViewReactionsPost,
    overlays: {
      emojiPickerOpen,
      viewReactionsPost,
      viewBotRunPost,
      onEmojiSelect,
      dismissActions: () => setActiveMessage(null),
      showEmojiPicker: () => setEmojiPickerOpen(true),
      dismissEmojiPicker: () => {
        setActiveMessage(null);
        setEmojiPickerOpen(false);
      },
      viewReactions: (post: db.Post) => {
        setViewReactionsPost(post);
        setActiveMessage(null);
      },
      viewBotRun: (post: db.Post) => {
        setActiveMessage(null);
        onPressBotRun(post);
      },
      dismissReactions: () => setViewReactionsPost(null),
      dismissBotRun: () => setViewBotRunPost(null),
    },
  };
}

export function ScrollerMessageOverlays({
  actions,
  postActionIds,
  isWindowNarrow,
  onPressReplies,
  onGoToBotRun,
}: {
  actions: ReturnType<typeof useScrollerMessageActions>;
  postActionIds: React.ComponentProps<
    typeof ChatMessageActions
  >['postActionIds'];
  isWindowNarrow: boolean;
  onPressReplies?: (post: db.Post) => void;
  onGoToBotRun?: (params: { botShip: string; lensId: string }) => void;
}) {
  const { activeMessage, overlays } = actions;
  const { emojiPickerOpen, viewReactionsPost, viewBotRunPost } = overlays;
  return (
    <>
      {activeMessage !== null && !emojiPickerOpen && (
        <Modal
          visible
          // Desktop actions dismiss themselves; modal dismissal there would
          // close the actions before their emoji picker can open.
          onDismiss={isWindowNarrow ? overlays.dismissActions : undefined}
        >
          <ChatMessageActions
            post={activeMessage}
            postActionIds={postActionIds}
            postRef={actions.refFor(activeMessage.id)}
            onDismiss={overlays.dismissActions}
            onReply={onPressReplies}
            onEdit={() => actions.onPressEdit(activeMessage)}
            onShowEmojiPicker={overlays.showEmojiPicker}
            onViewReactions={overlays.viewReactions}
            onViewBotRun={overlays.viewBotRun}
            mode="immediate"
          />
        </Modal>
      )}
      {emojiPickerOpen && activeMessage ? (
        <EmojiPickerSheet
          open
          onOpenChange={overlays.dismissEmojiPicker}
          onEmojiSelect={overlays.onEmojiSelect}
        />
      ) : null}
      {viewReactionsPost ? (
        <ViewReactionsSheet
          post={viewReactionsPost}
          open
          onOpenChange={overlays.dismissReactions}
        />
      ) : null}
      {viewBotRunPost ? (
        <ContextLensRunSheet
          post={viewBotRunPost}
          open
          onOpenChange={overlays.dismissBotRun}
          onExpand={onGoToBotRun}
        />
      ) : null}
    </>
  );
}
