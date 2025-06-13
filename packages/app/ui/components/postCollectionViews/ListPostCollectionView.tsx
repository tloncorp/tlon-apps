import {
  isChatChannel as getIsChatChannel,
  layoutForType,
  layoutTypeFromChannel,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList } from 'react-native';

import { useCurrentUserId } from '../../contexts';
import { usePostCollectionContext } from '../../contexts/postCollection';
import { EmptyChannelNotice } from '../Channel/EmptyChannelNotice';
import Scroller, { ScrollAnchor } from '../Channel/Scroller';
import { IPostCollectionView } from './shared';

export const ListPostCollection: IPostCollectionView = forwardRef(
  function ListPostCollection(_props, forwardedRef) {
    const ctx = usePostCollectionContext();
    const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
    const currentUserId = useCurrentUserId();
    const flatListRef = useRef<FlatList>(null);
    const collectionLayoutType = useMemo(
      () => layoutTypeFromChannel(ctx.channel),
      [ctx.channel]
    );
    const collectionLayout = useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );

    const renderEmptyComponent = useCallback(() => {
      return (
        <EmptyChannelNotice
          channel={ctx.channel}
          userId={currentUserId}
          loadPostsError={ctx.loadPostsError}
          isLoading={ctx.isLoadingPosts}
          onPressRetryLoad={ctx.onPressRetryLoad}
        />
      );
    }, [
      currentUserId,
      ctx.channel,
      ctx.loadPostsError,
      ctx.isLoadingPosts,
      ctx.onPressRetryLoad,
    ]);

    const canDrillIntoPost = useMemo(
      () => !getIsChatChannel(ctx.channel),
      [ctx.channel]
    );

    useImperativeHandle(forwardedRef, () => ({
      scrollToPostAtIndex(index: number) {
        flatListRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0.5,
        });
      },
    }));
    const scrollerAnchor: ScrollAnchor | null = useMemo(() => {
      // NB: technical behavior change: previously, we would avoid scroll-to-selected on notebooks.
      // afaict, there's no way to select a post in a notebook, so the UX should be the same.
      // (also, I personally think it's confusing to user to block scroll-to on selection for notebooks)
      if (ctx.selectedPostId) {
        return { type: 'selected', postId: ctx.selectedPostId };
      }

      if (collectionLayout.enableUnreadAnchor) {
        if (
          ctx.channelUnread?.countWithoutThreads &&
          ctx.channelUnread.firstUnreadPostId
        ) {
          return {
            type: 'unread',
            postId: ctx.channelUnread.firstUnreadPostId,
          };
        }
      }

      return null;
    }, [
      collectionLayout.enableUnreadAnchor,
      ctx.selectedPostId,
      ctx.channelUnread,
    ]);

    return (
      <Scroller
        key={scrollerAnchor?.postId}
        inverted={collectionLayout.scrollDirection === 'bottom-to-top'}
        renderItem={ctx.LegacyPostView}
        renderEmptyComponent={renderEmptyComponent}
        anchor={scrollerAnchor}
        posts={ctx.posts ?? null}
        hasNewerPosts={ctx.hasNewerPosts}
        hasOlderPosts={ctx.hasOlderPosts}
        editingPost={ctx.editingPost}
        setEditingPost={ctx.setEditingPost}
        channel={ctx.channel}
        collectionLayoutType={collectionLayoutType}
        firstUnreadId={
          ctx.channelUnread?.countWithoutThreads ?? 0 > 0
            ? ctx.channelUnread?.firstUnreadPostId
            : null
        }
        unreadCount={ctx.channelUnread?.countWithoutThreads ?? 0}
        onPressPost={canDrillIntoPost ? ctx.goToPost : undefined}
        onPressReplies={ctx.goToPost}
        onPressImage={ctx.goToImageViewer}
        onEndReached={ctx.onScrollEndReached}
        onStartReached={ctx.onScrollStartReached}
        onPressRetry={ctx.onPressRetrySend}
        onPressDelete={ctx.onPressDelete}
        activeMessage={activeMessage}
        setActiveMessage={setActiveMessage}
        ref={flatListRef}
        isLoading={ctx.isLoadingPosts}
        onPressScrollToBottom={ctx.scrollToBottom}
      />
    );
  }
);
