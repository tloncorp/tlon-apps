import {
  DraftInputId,
  useChannelContext,
  useThreadPosts,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { ForwardingProps } from '@tloncorp/ui';
import { useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { YStack } from 'tamagui';

import { usePostCollectionContext } from '../../contexts/postCollection';
import { ChannelHeader } from '../Channel/ChannelHeader';
import { DraftInputView } from '../Channel/DraftInputView';
import { DraftInputContext } from '../draftInputs';
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
  const { PostView, channel } = usePostCollectionContext();
  const channelCtx = useChannelContext({
    channelId: channel.id,
    draftKey: post.id,
  });
  const listRef = useRef<FlatList<ListItem>>(null);
  // use boolean coercion to also check if post.title is empty string
  const title = post.title ? post.title : 'Post';

  const listData = useListData({ root: post });

  const postContextMenu = usePostContextMenu(
    useMemo(
      () => ({
        performPostAction: (actionType, post) => {
          switch (actionType) {
            case 'viewReactions': {
              break;
            }

            case 'startThread': {
              break;
            }

            case 'edit': {
              channelCtx.setEditingPost(post);
            }
          }
        },
      }),
      [channelCtx]
    )
  );

  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  /** when `null`, input is not shown or presentation is unknown */
  const draftInputContext = useMemo((): DraftInputContext => {
    return {
      sendPostFromDraft: async (draft) => {
        channelCtx.setEditingPost(undefined);
        await store.finalizeAndSendPost(draft);
        listRef.current?.scrollToEnd();
      },
      setShouldBlur: setInputShouldBlur,
      shouldBlur: inputShouldBlur,

      ...channelCtx,
      channel,
    };
  }, [channel, inputShouldBlur, channelCtx]);

  return (
    <>
      <YStack backgroundColor={'$background'} {...forwardedProps}>
        <ChannelHeader
          channel={channel}
          group={channel.group}
          title={title}
          description={''}
          goBack={navigateBack}
          showSearchButton={false}
          // showSpinner={isLoadingPosts}
          post={post}
        />
        <FlatList
          ref={listRef}
          data={listData}
          renderItem={({ item, index }) => {
            const previousItem = index > 0 ? listData[index - 1] : undefined;
            const showAuthor =
              !previousItem ||
              previousItem.post.authorId !== item.post.authorId;
            return (
              <ContextGestureListener
                presentationCandidate={{
                  post: item.post,
                  postActionIds: ['delete', 'edit'],
                }}
                menuApi={postContextMenu}
              >
                {({ present }) => (
                  <PostView
                    post={item.post}
                    showAuthor={showAuthor}
                    showReplies={item.type !== 'op'}
                    onLongPress={present}
                  />
                )}
              </ContextGestureListener>
            );
          }}
          keyExtractor={(item) => item.post.id}
          contentInsetAdjustmentBehavior="scrollableAxes"
        />

        {/* Reply view - hardcode to be a chat input */}
        <DraftInputView
          draftInputContext={draftInputContext}
          type={DraftInputId.chat}
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
