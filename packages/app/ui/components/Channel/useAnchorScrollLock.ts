import { createDevLogger } from '@tloncorp/shared';
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
  const isScrollAttemptActiveRef = useRef(false);
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
  }, [posts?.length, didAnchorSearchTimeout, readyToDisplayPosts]);

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

      // If the anchor hasn't changed and we know its index, try to scroll to the estimated position
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

  const handleItemLayout = useCallback(
    (post: db.Post, index: number) => {
      renderedPostsRef.current.add(post.id);

      if (
        !userHasScrolled &&
        !didScrollToAnchor &&
        post.id === anchor?.postId &&
        flatListRef.current &&
        anchor?.postId === currentAnchorId.current &&
        !isScrollAttemptActiveRef.current
      ) {
        logger.log('scrolling to anchor post', { id: post.id, index });

        try {
          isScrollAttemptActiveRef.current = true;
          const shouldAnimateScroll = readyToDisplayPosts;

          if (collectionLayoutType === 'grid') {
            // Adjust the index for grid layout.
            // FlatList still conceptually uses a single column layout
            // with each row in the grid being one logical "item"
            const gridAdjustedIndex = Math.floor(index / columnsCount);
            logger.log('Using grid-adjusted index for scrollToIndex:', {
              originalIndex: index,
              gridAdjustedIndex,
              columnsCount,
            });
            flatListRef.current.scrollToIndex({
              index: gridAdjustedIndex,
              viewPosition: anchor.type === 'unread' ? 1 : 0.5,
              animated: shouldAnimateScroll,
            });
          } else {
            flatListRef.current.scrollToIndex({
              index,
              viewPosition: anchor.type === 'unread' ? 1 : 0.5,
              animated: shouldAnimateScroll,
            });
          }
        } catch (e) {
          logger.error('error scrolling to anchor post', e);
        } finally {
          setDidScrollToAnchor(true);
          isScrollAttemptActiveRef.current = false;
        }
      }

      // Set timeout if we've rendered all posts
      if (posts?.length && renderedPostsRef.current.size >= posts.length) {
        logger.log('all posts rendered');
        setDidAnchorSearchTimeout(true);
      }
    },
    [
      anchor?.postId,
      anchor?.type,
      userHasScrolled,
      flatListRef,
      posts,
      readyToDisplayPosts,
      collectionLayoutType,
      columnsCount,
    ]
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

  // Update current anchor ID and reset states when anchor changes
  useEffect(() => {
    if (anchor?.postId !== currentAnchorId.current) {
      logger.log('anchor changed', anchor?.postId);
      currentAnchorId.current = anchor?.postId;
      setUserHasScrolled(false);
      setDidAnchorSearchTimeout(false);
      renderedPostsRef.current.clear();
    }
  }, [anchor?.postId]);

  return {
    readyToDisplayPosts,
    scrollerItemProps: {
      onLayout: handleItemLayout,
    },
    flatlistProps: {
      onScrollBeginDrag: handleScrollBeginDrag,
      onScrollToIndexFailed: handleScrollToIndexFailed,
      maintainVisibleContentPosition: maintainVisibleContentPositionConfig,
    },
  };
}
