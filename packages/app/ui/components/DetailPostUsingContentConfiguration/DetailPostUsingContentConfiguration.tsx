import {
  DraftInputId,
  useChannelContext,
  useThreadPosts,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Story } from '@tloncorp/shared/urbit';
import { ForwardingProps } from '@tloncorp/ui';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { YStack } from 'tamagui';

import { useCurrentUserId } from '../../contexts';
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

  const sendReply = useSendReplyCallback({
    parent: post,
    channel,
  });

  const [inputShouldBlur, setInputShouldBlur] = useState(false);
  /** when `null`, input is not shown or presentation is unknown */
  const draftInputContext = useMemo((): DraftInputContext => {
    return {
      // TODO: pass draft configuration values?
      sendPost: async (content) => {
        await sendReply(content);
        listRef.current?.scrollToEnd();
      },
      sendPostFromDraft: async (draft) => {
        await store.finalizeAndSendPost(draft);
        listRef.current?.scrollToEnd();
      },
      setShouldBlur: setInputShouldBlur,
      shouldBlur: inputShouldBlur,

      ...channelCtx,
      channel,
    };
  }, [channel, inputShouldBlur, sendReply, channelCtx]);

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
        />
        <FlatList
          ref={listRef}
          data={listData}
          renderItem={({ item }) => (
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
                  showReplies={item.type !== 'op'}
                  onLongPress={present}
                />
              )}
            </ContextGestureListener>
          )}
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

function useSendReplyCallback(
  opts: {
    parent: db.Post;
    channel: db.Channel;
  } | null
) {
  return useCallback(
    async (content: Story) => {
      if (opts == null) {
        throw new Error('Attempted to send reply without parent post');
      }
      const { parent, channel } = opts;
      await store.sendReply({
        content,
        channel,
        parentId: parent.id,
        parentAuthor: parent.authorId,
      });
    },
    [opts]
  );
}
