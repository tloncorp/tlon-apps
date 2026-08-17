import {
  isChatChannel as getIsChatChannel,
  layoutForType,
  layoutTypeFromChannel,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useCurrentUserId } from '../../contexts/appDataContext';
import { usePostCollectionContext } from '../../contexts/postCollection';
import { EmptyChannelNotice } from '../Channel/EmptyChannelNotice';
import Scroller, { ScrollAnchor } from '../Channel/Scroller';
import { ThinkingState } from '../Channel/ThinkingState';
import { useShouldShowThinkingState } from '../Channel/useShouldShowThinkingState';
import { IPostCollectionView } from './shared';

interface ScrollerHandle {
  scrollToPost: (params: {
    postId: string;
    animated?: boolean;
    viewPosition?: number;
  }) => void;
  scrollToStart: (params: { animated?: boolean }) => void;
  scrollToEnd: (params: { animated?: boolean }) => void;
}

export const ListPostCollection: IPostCollectionView = forwardRef(
  function ListPostCollection(_props, forwardedRef) {
    const ctx = usePostCollectionContext();
    const [activeMessage, setActiveMessage] = useState<db.Post | null>(null);
    const currentUserId = useCurrentUserId();
    const shouldShowThinkingState = useShouldShowThinkingState(ctx.channel);
    const scrollerRef = useRef<ScrollerHandle>(null);
    const collectionLayoutType = useMemo(
      () => layoutTypeFromChannel(ctx.channel),
      [ctx.channel]
    );
    const collectionLayout = useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const anchorToEnd = collectionLayout.scrollDirection === 'bottom-to-top';
    const renderOrderedPosts = useMemo(
      () =>
        ctx.posts && anchorToEnd
          ? [...ctx.posts].reverse()
          : (ctx.posts ?? null),
      [anchorToEnd, ctx.posts]
    );
    const latestPostId = anchorToEnd
      ? renderOrderedPosts?.[renderOrderedPosts.length - 1]?.id
      : renderOrderedPosts?.[0]?.id;
    const listBottomComponent = useMemo(
      () =>
        shouldShowThinkingState ? (
          <ThinkingState
            conversationId={ctx.channel.id}
            channelType={ctx.channel.type}
            latestPostId={latestPostId}
            forcedLabel={ctx.pendingThinkingLabel}
          />
        ) : undefined,
      [
        shouldShowThinkingState,
        ctx.channel.id,
        ctx.channel.type,
        ctx.pendingThinkingLabel,
        latestPostId,
      ]
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
    const handlePressPost = useCallback(
      (post: db.Post) => {
        if (canDrillIntoPost) {
          ctx.goToPost(post);
          return;
        }
        ctx.inspectContextLensPost?.(post);
      },
      [canDrillIntoPost, ctx.goToPost, ctx.inspectContextLensPost]
    );

    const [highlightPostId, setHighlightPostId] = useState<string | null>(null);
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

    useEffect(() => {
      return () => {
        if (highlightTimerRef.current) {
          clearTimeout(highlightTimerRef.current);
        }
      };
    }, []);

    useImperativeHandle(forwardedRef, () => ({
      scrollToPost(postId: string, viewPosition?: number) {
        scrollerRef.current?.scrollToPost({
          postId,
          animated: false,
          viewPosition,
        });
      },
      scrollToStart(opts: { animated?: boolean }) {
        scrollerRef.current?.scrollToStart(opts);
      },
      scrollToLatest(opts: { animated?: boolean }) {
        if (anchorToEnd) {
          scrollerRef.current?.scrollToEnd(opts);
        } else {
          scrollerRef.current?.scrollToStart(opts);
        }
      },
      highlightPost(postId: string) {
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        setHighlightPostId(postId);
        highlightTimerRef.current = setTimeout(() => {
          setHighlightPostId(null);
        }, 5000);
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
      collectionLayout.enableUnreadAnchor,
      ctx.selectedPostId,
      ctx.initialChannelUnread,
    ]);
    return (
      <Scroller
        anchorToEnd={anchorToEnd}
        renderItem={ctx.LegacyPostView}
        renderEmptyComponent={renderEmptyComponent}
        anchor={scrollerAnchor}
        posts={renderOrderedPosts}
        hasNewerPosts={ctx.hasNewerPosts}
        hasOlderPosts={ctx.hasOlderPosts}
        editingPost={ctx.editingPost}
        setEditingPost={ctx.setEditingPost}
        channel={ctx.channel}
        collectionLayoutType={collectionLayoutType}
        firstUnreadId={
          (ctx.initialChannelUnread?.countWithoutThreads ?? 0 > 0)
            ? ctx.initialChannelUnread?.firstUnreadPostId
            : null
        }
        unreadCount={ctx.initialChannelUnread?.countWithoutThreads ?? 0}
        onPressPost={
          canDrillIntoPost || ctx.inspectContextLensPost
            ? handlePressPost
            : undefined
        }
        onPressReplies={ctx.goToPost}
        onPressImage={ctx.goToMediaViewer}
        onEndReached={anchorToEnd ? ctx.onLoadNewerPosts : ctx.onLoadOlderPosts}
        onStartReached={
          anchorToEnd ? ctx.onLoadOlderPosts : ctx.onLoadNewerPosts
        }
        onPressRetry={ctx.onPressRetrySend}
        onPressDelete={ctx.onPressDelete}
        activeMessage={activeMessage}
        setActiveMessage={setActiveMessage}
        ref={scrollerRef}
        isLoading={ctx.isLoadingPosts}
        onPressScrollToBottom={ctx.scrollToBottom}
        onGoToBotRun={ctx.goToBotRun}
        onOpenContextLens={ctx.openContextLensForPost}
        contextLensSelectedPostId={ctx.contextLensSelectedPostId}
        highlightPostId={highlightPostId}
        listBottomComponent={listBottomComponent}
        contentInsets={ctx.contentInsets}
      />
    );
  }
);
