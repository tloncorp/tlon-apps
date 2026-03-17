import { createDevLogger, useMutableCallback } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlatList } from 'react-native';

import { ScrollAnchor } from './Scroller';

const logger = createDevLogger('useAnchorScrollLock', false);

/**
 * Hook to manage scroll position and anchor post visibility during post loading
 */
export function useAnchorScrollLock({
  flatListRef,
  posts,
  anchor,
  hasNewerPosts,
  shouldMaintainVisibleContentPosition,
  collectionLayoutType,
  columnsCount,
}: {
  flatListRef: RefObject<FlatList<db.Post>>;
  posts: db.Post[] | null;
  anchor: ScrollAnchor | null | undefined;
  hasNewerPosts?: boolean;
  shouldMaintainVisibleContentPosition: boolean;
  collectionLayoutType: string;
  columnsCount: number;
}) {
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [didAnchorSearchTimeout, setDidAnchorSearchTimeout] = useState(false);
  const [didScrollToAnchor, setDidScrollToAnchor] = useState(false);
  const currentAnchorId = useRef<string | undefined>(anchor?.postId);
  const renderedPostsRef = useRef(new Set<string>());
  const scrollPhaseRef = useRef<'idle' | 'scrolled' | 'done'>('idle');
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const readyToDisplayPosts =
    !anchor?.postId || didAnchorSearchTimeout || didScrollToAnchor;

  const showPostsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (posts?.length && !showPostsTimeoutRef.current && !readyToDisplayPosts) {
      showPostsTimeoutRef.current = setTimeout(() => {
        logger.log('posts are ready for display');
        setDidAnchorSearchTimeout(true);
      }, 2000);
    }
  }, [posts?.length, readyToDisplayPosts]);

  // Find the index of the anchor post in the posts array
  const anchorIndex = useMemo(() => {
    return posts?.findIndex((p) => p.id === anchor?.postId) ?? -1;
  }, [posts, anchor?.postId]);

  const handleScrollBeginDrag = useCallback(() => {
    setUserHasScrolled(true);
  }, []);

  const handleScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      logger.log('scroll to index failed', { info });

      // Best-guess fallback: scroll to estimated offset to get close.
      // This causes FlatList to render items near the target. When the
      // anchor post's View lays out, handleItemLayout fires and does
      // the correction scrollToIndex (phase is still 'scrolled').
      if (
        anchor?.postId === currentAnchorId.current &&
        flatListRef.current &&
        anchorIndex !== -1
      ) {
        const offset = anchorIndex * info.averageItemLength;
        logger.log('doing best guess scroll to offset', offset);
        flatListRef.current.scrollToOffset({ offset, animated: false });
      }
    },
    [anchor?.postId, flatListRef, anchorIndex]
  );

  const handleItemLayout = useMutableCallback(
    (post: db.Post, index: number) => {
      renderedPostsRef.current.add(post.id);

      if (
        !userHasScrolled &&
        !didScrollToAnchor &&
        post.id === anchor?.postId &&
        flatListRef.current &&
        anchor?.postId === currentAnchorId.current &&
        scrollPhaseRef.current !== 'done'
      ) {
        const effectiveIndex =
          collectionLayoutType === 'grid'
            ? Math.floor(index / columnsCount)
            : index;
        const viewPosition = anchor.type === 'unread' ? 1 : 0.5;
        const isCorrection = scrollPhaseRef.current === 'scrolled';

        logger.log(
          isCorrection
            ? 'correction scroll to anchor post'
            : 'scrolling to anchor post',
          { id: post.id, index }
        );

        if (collectionLayoutType === 'grid') {
          logger.log('Using grid-adjusted index for scrollToIndex:', {
            originalIndex: index,
            gridAdjustedIndex: effectiveIndex,
            columnsCount,
          });
        }

        try {
          flatListRef.current.scrollToIndex({
            index: effectiveIndex,
            viewPosition,
            animated: false,
          });
        } catch (e) {
          logger.error('error scrolling to anchor post', e);
          scrollPhaseRef.current = 'done';
          setDidScrollToAnchor(true);
          return;
        }

        if (isCorrection) {
          // Correction done — mark complete immediately.
          scrollPhaseRef.current = 'done';
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          setDidScrollToAnchor(true);
        } else {
          // Initial scroll done — allow one re-layout correction.
          // handleItemLayout is wired to the View's onLayout, so it fires
          // again if the anchor post's measured height changes. That
          // re-invocation (phase 'scrolled') does the correction scroll.
          scrollPhaseRef.current = 'scrolled';
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            // No re-layout happened — first scroll was accurate enough.
            if (scrollPhaseRef.current === 'scrolled') {
              scrollPhaseRef.current = 'done';
              setDidScrollToAnchor(true);
            }
          }, 200);
        }
      }

      // Set timeout if we've rendered all posts
      if (posts?.length && renderedPostsRef.current.size >= posts.length) {
        logger.log('all posts rendered');
        setDidAnchorSearchTimeout(true);
      }
    }
  );

  const maintainVisibleContentPositionConfig = useMemo(() => {
    if (!shouldMaintainVisibleContentPosition) {
      return undefined;
    }

    return {
      minIndexForVisible: 0,
      autoscrollToTopThreshold: hasNewerPosts ? undefined : 0,
    };
  }, [hasNewerPosts, shouldMaintainVisibleContentPosition]);

  // Clean up retry timer on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  // Update current anchor ID and reset states when anchor changes
  useEffect(() => {
    if (anchor?.postId !== currentAnchorId.current) {
      logger.log('anchor changed', anchor?.postId);
      currentAnchorId.current = anchor?.postId;
      setUserHasScrolled(false);
      setDidAnchorSearchTimeout(false);
      setDidScrollToAnchor(false);
      renderedPostsRef.current.clear();
      scrollPhaseRef.current = 'idle';
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    }
  }, [anchor?.postId]);

  const scrollerItemProps = useMemo(
    () => ({
      onLayout: handleItemLayout,
    }),
    [handleItemLayout]
  );

  const flatlistProps = useMemo(
    () => ({
      onScrollBeginDrag: handleScrollBeginDrag,
      onScrollToIndexFailed: handleScrollToIndexFailed,
      maintainVisibleContentPosition: maintainVisibleContentPositionConfig,
    }),
    [
      handleScrollBeginDrag,
      handleScrollToIndexFailed,
      maintainVisibleContentPositionConfig,
    ]
  );

  return useMemo(
    () => ({
      readyToDisplayPosts,
      scrollerItemProps,
      flatlistProps,
    }),
    [readyToDisplayPosts, scrollerItemProps, flatlistProps]
  );
}
