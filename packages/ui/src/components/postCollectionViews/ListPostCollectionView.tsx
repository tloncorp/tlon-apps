import { isChatChannel as getIsChatChannel } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
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
import { usePostCollectionContextUnsafelyUnwrapped } from '../../contexts/postCollection';
import { EmptyChannelNotice } from '../Channel/EmptyChannelNotice';
import { PostView } from '../Channel/PostView';
import Scroller, { ScrollAnchor } from '../Channel/Scroller';
import { IPostCollectionView } from './shared';

export const ListPostCollection: IPostCollectionView = forwardRef(
  function ListPostCollection(props, forwardedRef) {
    const ctx = usePostCollectionContextUnsafelyUnwrapped();
    const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
    const currentUserId = useCurrentUserId();
    const flatListRef = useRef<FlatList>(null);

    const renderEmptyComponent = useCallback(() => {
      return (
        <EmptyChannelNotice channel={props.channel} userId={currentUserId} />
      );
    }, [currentUserId, props.channel]);

    const canDrillIntoPost = useMemo(
      () => !getIsChatChannel(props.channel),
      [props.channel]
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

      if (props.collectionLayout.enableUnreadAnchor) {
        if (
          ctx.initialChannelUnread?.countWithoutThreads &&
          ctx.initialChannelUnread.firstUnreadPostId
        ) {
          return {
            type: 'unread',
            postId: ctx.initialChannelUnread.firstUnreadPostId,
          };
        }
      }

      return null;
    }, [
      props.collectionLayout.enableUnreadAnchor,
      ctx.selectedPostId,
      ctx.initialChannelUnread,
    ]);

    return (
      <Scroller
        key={scrollerAnchor?.postId}
        inverted={props.collectionLayout.scrollDirection === 'bottom-to-top'}
        renderItem={PostView}
        renderEmptyComponent={renderEmptyComponent}
        anchor={scrollerAnchor}
        posts={ctx.posts ?? null}
        hasNewerPosts={ctx.hasNewerPosts}
        hasOlderPosts={ctx.hasOlderPosts}
        editingPost={ctx.editingPost}
        setEditingPost={ctx.setEditingPost}
        channel={props.channel}
        firstUnreadId={
          ctx.initialChannelUnread?.countWithoutThreads ?? 0 > 0
            ? ctx.initialChannelUnread?.firstUnreadPostId
            : null
        }
        unreadCount={ctx.initialChannelUnread?.countWithoutThreads ?? 0}
        onPressPost={canDrillIntoPost ? undefined : ctx.goToPost}
        onPressReplies={ctx.goToPost}
        onPressImage={ctx.goToImageViewer}
        onEndReached={ctx.onScrollEndReached}
        onStartReached={ctx.onScrollStartReached}
        onPressRetry={ctx.onPressRetry}
        onPressDelete={ctx.onPressDelete}
        activeMessage={activeMessage}
        setActiveMessage={setActiveMessage}
        ref={flatListRef}
        headerMode={ctx.headerMode}
      />
    );
  }
);
