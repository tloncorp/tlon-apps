import { ChannelAction, useThreadPosts } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  ElementRef,
  RefObject,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList, View as RNView } from 'react-native';
import { YStack } from 'tamagui';

import { usePostCollectionContextUnsafelyUnwrapped } from '../contexts/postCollection';
import { ForwardingProps } from '../utils/react';
import { ChannelHeader } from './Channel/ChannelHeader';
import { ChatMessageActions } from './ChatMessage/ChatMessageActions/Component';
import { Modal } from './Modal';

type ListItem =
  | { type: 'op'; post: db.Post }
  | { type: 'reply'; post: db.Post };

export function DetailPostView({
  post,
  navigateBack,
  ...forwardedProps
}: ForwardingProps<
  typeof YStack,
  { post: db.Post; navigateBack?: () => void },
  'backgroundColor'
>) {
  const { PostView, channel } = usePostCollectionContextUnsafelyUnwrapped();
  // use boolean coercion to also check if post.title is empty string
  const title = post.title ? post.title : 'Post';

  const listData = useListData({ root: post });

  const postContextMenu = usePostContextMenu(
    useMemo(
      () => ({
        performPostAction: (actionType, _post) => {
          switch (actionType) {
            case 'viewReactions': {
              break;
            }

            case 'startThread': {
              break;
            }

            case 'edit': {
              break;
            }
          }
        },
      }),
      []
    )
  );

  return (
    <>
      <YStack backgroundColor={'$background'} {...forwardedProps}>
        <ChannelHeader
          channel={channel}
          group={channel.group}
          title={title}
          goBack={navigateBack}
          showSearchButton={false}
          // showSpinner={isLoadingPosts}
          post={post}
          mode="default"
        />
        <FlatList
          data={listData}
          renderItem={({ item }) => (
            <ContextGestureListener
              presentationCandidate={{
                post: item.post,
                postActionIds: ['delete', 'edit', 'quote'],
              }}
              menuApi={postContextMenu}
            >
              {({ present }) => (
                <PostView
                  post={item.post}
                  showReplies={item.type !== 'op'}
                  onLongPress={present}
                />
              )}
            </ContextGestureListener>
          )}
          contentInsetAdjustmentBehavior="scrollableAxes"
        />
      </YStack>
      {postContextMenu.mount()}
    </>
  );
}

function useListData({ root }: { root: db.Post }) {
  const threadPostsQuery = useThreadPosts({
    postId: root.id,
    authorId: root.authorId,
    channelId: root.channelId,
  });

  return useMemo(() => {
    const out: ListItem[] = [{ type: 'op', post: root }];
    if (threadPostsQuery.data != null && threadPostsQuery.data?.length > 0) {
      // threadPostsQuery is in timestamp descending order
      // iterate backwards to avoid a reverse()
      for (let i = threadPostsQuery.data.length - 1; i >= 0; i--) {
        const reply = threadPostsQuery.data[i];
        out.push({ type: 'reply', post: reply });
      }
    }
    return out;
  }, [root, threadPostsQuery.data]);
}

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
function usePostContextMenu(opts: {
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

function ContextGestureListener({
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
