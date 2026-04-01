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
 * useAnchorScrollLock
 *
 * Manages scrolling to an anchor post (selected post or unread marker)
 * in a virtualized FlatList where the target item may not be measured yet.
 *
 * Scroll phase state machine (`scrollPhaseRef`):
 *
 *   idle -> scrolled -> done
 *     \--------------->/
 *        (error / retry exhaustion)
 *
 *   idle:
 *     No anchor scroll attempted yet. When the anchor item's layout fires,
 *     `handleItemLayout` performs the initial `scrollToIndex`.
 *
 *   scrolled:
 *     An initial anchor scroll was attempted. We allow one re-layout-based
 *     correction: if the anchor item's layout fires again, `handleItemLayout`
 *     performs a correction scroll and transitions to `done`. A 200ms timeout
 *     also transitions to `done` if no correction layout arrives.
 *
 *   done:
 *     Anchor scroll handling is complete for the current anchor. Further
 *     `handleItemLayout` invocations do not trigger additional scrolls.
 *
 * Failure / retry path (`handleScrollToIndexFailed`):
 *   If `scrollToIndex` fails because the target index is not yet measurable,
 *   we first do a best-guess `scrollToOffset`, then retry `scrollToIndex`
 *   up to a bounded number of times. A retry may itself trigger
 *   `onScrollToIndexFailed` synchronously, so the code compares
 *   `failureRetryCountRef` before/after the retry call and avoids replacing
 *   a newly scheduled retry with the success-path timeout.
 *
 * Anchor changes:
 *   When `anchor.postId` changes, the hook resets its refs/state so a fresh
 *   anchor-scroll sequence can run. This supports re-navigation to a new
 *   selected post within the same channel.
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
  const MAX_FAILURE_RETRIES = 3;
  const RETRY_INTERVAL_MS = 200;
  const SCROLL_COMPLETED_TIMEOUT_MS = 200;
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [didAnchorSearchTimeout, setDidAnchorSearchTimeout] = useState(false);
  const [didScrollToAnchor, setDidScrollToAnchor] = useState(false);
  const currentAnchorId = useRef<string | undefined>(anchor?.postId);
  const renderedPostsRef = useRef(new Set<string>());
  const scrollPhaseRef = useRef<'idle' | 'scrolled' | 'done'>('idle');
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const failureRetryCountRef = useRef(0);
  const userHasScrolledRef = useRef(userHasScrolled);
  userHasScrolledRef.current = userHasScrolled;
  const readyToDisplayPosts =
    !anchor?.postId || didAnchorSearchTimeout || didScrollToAnchor;

  const showPostsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (posts?.length && !showPostsTimeoutRef.current && !readyToDisplayPosts) {
      showPostsTimeoutRef.current = setTimeout(() => {
        logger.log('posts are ready for display');
        setDidAnchorSearchTimeout(true);
        showPostsTimeoutRef.current = null;
      }, 2000);
    }
  }, [posts?.length, readyToDisplayPosts]);

  // Find the index of the anchor post in the posts array
  const anchorIndex = useMemo(() => {
    return posts?.findIndex((p) => p.id === anchor?.postId) ?? -1;
  }, [posts, anchor?.postId]);

  const anchorIndexRef = useRef(anchorIndex);
  anchorIndexRef.current = anchorIndex;

  // For grid layouts, FlatList indexes by row, not by item. Centralize
  // the raw-item-index → row-index conversion to avoid inconsistencies.
  const getEffectiveIndex = useCallback(
    (rawIndex: number) =>
      collectionLayoutType === 'grid'
        ? Math.floor(rawIndex / columnsCount)
        : rawIndex,
    [collectionLayoutType, columnsCount]
  );

  const handleScrollBeginDrag = useCallback(() => {
    setUserHasScrolled(true);
  }, []);

  const handleScrollToIndexFailed = useMutableCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      logger.log('scroll to index failed', { info });

      // Cancel the done-timeout — the initial scroll did not reach the target.
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

      // Best-guess fallback: scroll to estimated offset to get close.
      if (
        anchor?.postId === currentAnchorId.current &&
        flatListRef.current &&
        anchorIndex !== -1
      ) {
        const offset = getEffectiveIndex(anchorIndex) * info.averageItemLength;
        logger.log('doing best guess scroll to offset', offset);
        flatListRef.current.scrollToOffset({ offset, animated: false });
      }

      // Schedule a bounded retry. After the fallback offset, FlatList
      // renders items near the target with better measurement data.
      if (failureRetryCountRef.current < MAX_FAILURE_RETRIES) {
        failureRetryCountRef.current++;
        retryTimerRef.current = setTimeout(() => {
          const idx = anchorIndexRef.current;
          if (
            idx !== -1 &&
            flatListRef.current &&
            !userHasScrolledRef.current &&
            anchor?.postId === currentAnchorId.current
          ) {
            const retryEffectiveIndex = getEffectiveIndex(idx);
            const viewPos = anchor?.type === 'unread' ? 1 : 0.5;
            logger.log('retrying scroll after failure', {
              index: retryEffectiveIndex,
              attempt: failureRetryCountRef.current,
            });
            try {
              const countBefore = failureRetryCountRef.current;
              flatListRef.current.scrollToIndex({
                index: retryEffectiveIndex,
                viewPosition: viewPos,
                animated: false,
              });
              // Only start a done-timeout if onScrollToIndexFailed did not
              // fire synchronously during the scrollToIndex above.
              if (failureRetryCountRef.current === countBefore) {
                retryTimerRef.current = setTimeout(() => {
                  if (scrollPhaseRef.current === 'scrolled') {
                    scrollPhaseRef.current = 'done';
                    setDidScrollToAnchor(true);
                  }
                }, SCROLL_COMPLETED_TIMEOUT_MS);
              }
            } catch (e) {
              logger.error('retry scroll after failure failed', e);
              scrollPhaseRef.current = 'done';
              setDidScrollToAnchor(true);
            }
          }
        }, RETRY_INTERVAL_MS);
      } else {
        // Max retries exhausted — mark complete to unblock the UI.
        logger.log('max failure retries exhausted');
        scrollPhaseRef.current = 'done';
        setDidScrollToAnchor(true);
      }
    }
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
        const effectiveIndex = getEffectiveIndex(index);
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
          // Only start the done-timeout if onScrollToIndexFailed did not
          // already fire synchronously during scrollToIndex above.
          // If it did, failureRetryCountRef.current > 0 and the failure
          // handler already owns retryTimerRef with a retry scheduled.
          if (failureRetryCountRef.current === 0) {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              // No re-layout happened — first scroll was accurate enough.
              if (scrollPhaseRef.current === 'scrolled') {
                scrollPhaseRef.current = 'done';
                setDidScrollToAnchor(true);
              }
            }, SCROLL_COMPLETED_TIMEOUT_MS);
          }
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

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (showPostsTimeoutRef.current)
        clearTimeout(showPostsTimeoutRef.current);
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
      failureRetryCountRef.current = 0;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (showPostsTimeoutRef.current) {
        clearTimeout(showPostsTimeoutRef.current);
        showPostsTimeoutRef.current = null;
      }
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
