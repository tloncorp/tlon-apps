import { ChannelAction } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Modal } from '@tloncorp/ui';
import { ElementRef, RefObject, useCallback, useRef, useState } from 'react';
import { useMemo } from 'react';
import { View as RNView } from 'react-native';

import { ChatMessageActions } from '../ChatMessage/ChatMessageActions/Component';

interface PostContextMenuPresentation {
  anchorRef: RefObject<ElementRef<typeof RNView>>;
  postActionIds: ChannelAction.Id[];
  post: db.Post;
}

// ensures that `Sub` is a narrowing of `T` - so if `T` changes, `Sub`
// will be assured to remain a subtype
type PickSubtype<T, Sub extends T> = Sub;

type PostContextMenuActions = PickSubtype<
  ChannelAction.Id,
  'viewReactions' | 'startThread' | 'edit'
>;

export function usePostContextMenu(opts: {
  performPostAction: (
    actionType: PostContextMenuActions,
    post: db.Post
  ) => void;
}) {
  const [presentation, setPresentation] =
    useState<PostContextMenuPresentation | null>(null);

  const performActionAndDismissCallback = useCallback(
    (actionType: PostContextMenuActions) => {
      return () => {
        if (presentation == null) {
          return;
        }
        opts.performPostAction(actionType, presentation.post);
        setPresentation(null);
      };
    },
    [opts, presentation]
  );

  const mount = useCallback(() => {
    return (
      <Modal
        visible={presentation !== null}
        onDismiss={() => setPresentation(null)}
      >
        {presentation !== null && (
          <ChatMessageActions
            post={presentation.post}
            postActionIds={presentation.postActionIds}
            postRef={presentation.anchorRef}
            onDismiss={() => setPresentation(null)}
            onReply={performActionAndDismissCallback('startThread')}
            onEdit={performActionAndDismissCallback('edit')}
            onViewReactions={performActionAndDismissCallback('viewReactions')}
            mode="immediate"
          />
        )}
      </Modal>
    );
  }, [performActionAndDismissCallback, presentation]);

  return useMemo(
    () => ({
      present: setPresentation,
      dismiss: () => setPresentation(null),
      mount,
    }),
    [mount]
  );
}

export function ContextGestureListener({
  children,
  menuApi,
  presentationCandidate,
}: {
  children: (api: { present: () => void }) => JSX.Element;
  menuApi: {
    present: (opts: PostContextMenuPresentation) => void;
    dismiss: () => void;
  };
  presentationCandidate: Pick<
    PostContextMenuPresentation,
    'post' | 'postActionIds'
  >;
}) {
  const contentContainer = useRef<ElementRef<typeof RNView>>(null);
  const present = useCallback(() => {
    menuApi.present({
      ...presentationCandidate,
      anchorRef: contentContainer,
    });
  }, [contentContainer, menuApi, presentationCandidate]);
  return <RNView ref={contentContainer}>{children({ present })}</RNView>;
}
