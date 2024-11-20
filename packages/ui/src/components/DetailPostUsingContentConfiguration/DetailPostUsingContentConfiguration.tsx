import { useThreadPosts } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useMemo } from 'react';
import { FlatList } from 'react-native';
import { YStack } from 'tamagui';

import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { ForwardingProps } from '../../utils/react';
import { ChannelHeader } from '../Channel/ChannelHeader';
import { ContextGestureListener, usePostContextMenu } from './contextmenu';

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
