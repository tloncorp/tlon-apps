import { type LegendListRef } from '@legendapp/list/react-native';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import { layoutForType } from '@tloncorp/shared';
import * as React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScrollDirectionTracker } from '../../../contexts/scroll';
import { PostList as PostListFlatList } from './PostListFlatList';
import {
  getPostListAnchorKey,
  getPostListInitialization,
  shouldSnapUnreadAnchorToEnd,
} from './postListInitialization';
import {
  PostListComponent,
  PostListMethods,
  PostWithNeighbors,
  usePostListBottomCallbacks,
  usesConversationPostList,
} from './shared';

// V1 uses bounded wall-clock fallbacks because LegendList does not expose a
// single "all requested rows are measured" signal. Replace these with an
// event-driven quiescence check when the list provides one.
const ANCHOR_RESOLUTION_TIMEOUT_MS = 2_000;
const ESTIMATED_ITEM_SIZE = 120;
/**
 * How long after the initial scroll we keep re-applying the anchor position as
 * items report their real sizes. Item sizes only settle after measurement, and
 * the first scroll is computed from `ESTIMATED_ITEM_SIZE`, so without this the
 * list keeps whatever position the estimate produced.
 */
const ANCHOR_SETTLE_WINDOW_MS = 1_000;

function getPostId({ post }: PostWithNeighbors) {
  return post.id;
}

type IndexedAnchorPosition = {
  index: number;
  viewPosition: number;
  viewOffset: number;
};
type AnchorPosition = 'end' | IndexedAnchorPosition;

function isSameAnchorPosition(
  left: AnchorPosition | undefined,
  right: AnchorPosition | undefined
) {
  return (
    left === right ||
    (typeof left === 'object' &&
      typeof right === 'object' &&
      left.index === right.index &&
      left.viewPosition === right.viewPosition &&
      left.viewOffset === right.viewOffset)
  );
}

export const PostList: PostListComponent = React.forwardRef(
  (props, forwardedRef) => {
    return usesConversationPostList(props) ? (
      <ConversationPostList {...props} ref={forwardedRef} />
    ) : (
      <PostListFlatList {...props} ref={forwardedRef} />
    );
  }
);
PostList.displayName = 'PostList';

/**
 * LegendList-backed implementation for upright native conversations. Callers
 * provide posts in visual order so every renderer shares one coordinate
 * system.
 */
const ConversationPostList: PostListComponent = React.forwardRef(
  (
    {
      postsWithNeighbors,
      scrollEnabled = true,
      anchorToEnd = false,
      contentContainerStyle,
      style,
      renderItem,
      renderEmptyComponent,
      onStartReached,
      onStartReachedThreshold,
      onEndReached,
      onEndReachedThreshold,
      anchor,
      hasNewerPosts,
      channel,
      collectionLayoutType,
      onInitialScrollCompleted,
      onScrolledToBottom,
      onScrolledToBottomThreshold = 1,
      onScrolledAwayFromBottom,
      listHeaderComponent,
      listBottomComponent,
      isLoading = false,
    },
    forwardedRef
  ) => {
    const listRef = React.useRef<LegendListRef>(null);
    const didStartInitialScrollRef = React.useRef(false);
    const anchorGenerationRef = React.useRef(0);
    const userHasScrolledRef = React.useRef(false);
    const appliedAnchorPositionRef = React.useRef<AnchorPosition | undefined>(
      undefined
    );
    const [didFinishInitialScroll, setDidFinishInitialScroll] =
      React.useState(false);
    const anchorSettledRef = React.useRef(false);
    const settleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
    const [viewportHeight, setViewportHeight] = React.useState(0);
    const insets = useSafeAreaInsets();
    const collectionLayout = React.useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const anchorIndex = React.useMemo(() => {
      if (!anchor?.postId) {
        return -1;
      }

      return postsWithNeighbors.findIndex(
        ({ post }) => post.id === anchor.postId
      );
    }, [anchor?.postId, postsWithNeighbors]);
    const [timedOutAnchorId, setTimedOutAnchorId] = React.useState<
      string | null
    >(null);
    const didTimeoutWaitingForAnchor =
      !!anchor?.postId && timedOutAnchorId === anchor.postId;
    const anchorKey = getPostListAnchorKey(anchor);
    const {
      mountKey: listMountKey,
      isAnchorReady: isInitialAnchorReady,
      shouldStartAnchorTimeout,
    } = getPostListInitialization({
      anchorKey,
      anchorIndex,
      didTimeoutWaitingForAnchor,
      isLoading,
    });

    const previousAnchorKeyRef = React.useRef(anchorKey);
    React.useLayoutEffect(() => {
      if (previousAnchorKeyRef.current === anchorKey) {
        return;
      }

      previousAnchorKeyRef.current = anchorKey;
      anchorGenerationRef.current += 1;
      didStartInitialScrollRef.current = false;
      setDidFinishInitialScroll(false);
      userHasScrolledRef.current = false;
      appliedAnchorPositionRef.current = undefined;
      anchorSettledRef.current = false;
      setTimedOutAnchorId(null);
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    }, [anchorKey]);

    React.useEffect(() => {
      const anchorId = anchor?.postId;
      if (!shouldStartAnchorTimeout || !anchorId) {
        return;
      }

      const timeout = setTimeout(() => {
        setTimedOutAnchorId(anchorId);
      }, ANCHOR_RESOLUTION_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }, [anchor?.postId, shouldStartAnchorTimeout]);
    const initialScrollIndex = React.useMemo<IndexedAnchorPosition | undefined>(
      () =>
        anchorIndex === -1 || didTimeoutWaitingForAnchor
          ? undefined
          : {
              index: anchorIndex,
              viewPosition: anchor?.type === 'unread' ? 0 : 0.5,
              viewOffset: 0,
            },
      [anchor?.type, anchorIndex, didTimeoutWaitingForAnchor]
    );
    // Top-aligning the first unread is right when there is a run of unreads to
    // read down through. When the messages after the anchor cannot fill a
    // viewport, there is nothing below it, so
    // top-aligning strands the view above the natural bottom - the user lands
    // short with content still to scroll. Land at the end instead.
    //
    // Defaults to false until the viewport is measured, so an unmeasured first
    // pass keeps the ordinary anchor behaviour rather than jumping to the end.
    // Rich media can exceed the estimate; the settle corrections below repair
    // the landing as real row sizes arrive.
    const estimatedAnchorExtent =
      anchorIndex === -1
        ? undefined
        : (postsWithNeighbors.length - anchorIndex) * ESTIMATED_ITEM_SIZE;
    const shouldSnapAnchorToEnd = shouldSnapUnreadAnchorToEnd({
      anchorType: anchor?.type,
      estimatedAnchorExtent,
      hasNewerPosts,
      anchorToEnd,
      viewportHeight,
    });
    const anchorPosition: AnchorPosition | undefined =
      shouldSnapAnchorToEnd ||
      (anchorToEnd && (!anchor?.postId || didTimeoutWaitingForAnchor))
        ? 'end'
        : initialScrollIndex;
    const latestAnchorPositionRef = React.useRef<AnchorPosition | undefined>(
      anchorPosition
    );
    React.useLayoutEffect(() => {
      latestAnchorPositionRef.current = anchorPosition;
    }, [anchorPosition]);

    /**
     * Applies the resolved anchor position, choosing between the anchor target
     * and the list end. Every path that positions the list on initial load goes
     * through here so they cannot disagree.
     */
    const applyAnchorPosition = React.useCallback(async () => {
      const target = latestAnchorPositionRef.current;
      if (target === 'end') {
        appliedAnchorPositionRef.current = target;
        await listRef.current?.scrollToEnd({ animated: false });
        return true;
      }

      if (!target) {
        return false;
      }

      appliedAnchorPositionRef.current = target;
      await listRef.current?.scrollToIndex({ ...target, animated: false });
      return true;
    }, []);
    const { onScroll: handleScroll, isAtBottom } = useScrollDirectionTracker({
      atBottomThreshold: onScrolledToBottomThreshold,
      bottomAtEnd: true,
    });
    usePostListBottomCallbacks(isAtBottom, {
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });
    const handleLoad = React.useCallback(() => {
      if (!isInitialAnchorReady || didStartInitialScrollRef.current) {
        return;
      }
      didStartInitialScrollRef.current = true;
      const anchorGeneration = anchorGenerationRef.current;

      const completeInitialScroll = async () => {
        try {
          if (anchorGeneration !== anchorGenerationRef.current) {
            return;
          }

          // The around-anchor query can prepend cached history while
          // LegendList is bootstrapping. Re-resolve the current anchor index
          // before releasing queued edge events.
          await applyAnchorPosition();

          if (anchorGeneration !== anchorGenerationRef.current) {
            return;
          }

          const updatedTarget = latestAnchorPositionRef.current;
          if (
            updatedTarget &&
            !isSameAnchorPosition(
              updatedTarget,
              appliedAnchorPositionRef.current
            )
          ) {
            await applyAnchorPosition();
          }
        } catch {
          // Navigation can cancel the imperative scroll while unmounting.
        } finally {
          if (anchorGeneration === anchorGenerationRef.current) {
            setDidFinishInitialScroll(true);
            onInitialScrollCompleted?.();
            settleTimerRef.current = setTimeout(() => {
              if (anchorGeneration === anchorGenerationRef.current) {
                anchorSettledRef.current = true;
              }
            }, ANCHOR_SETTLE_WINDOW_MS);
          }
        }
      };

      void completeInitialScroll();
    }, [applyAnchorPosition, isInitialAnchorReady, onInitialScrollCompleted]);

    React.useEffect(() => {
      if (
        !didFinishInitialScroll ||
        userHasScrolledRef.current ||
        !anchorPosition ||
        isSameAnchorPosition(anchorPosition, appliedAnchorPositionRef.current)
      ) {
        return;
      }

      void applyAnchorPosition().catch(() => {
        // The list may unmount while the inset correction is in flight.
      });
    }, [anchorPosition, applyAnchorPosition, didFinishInitialScroll]);

    // The initial scroll offset is derived from `ESTIMATED_ITEM_SIZE`. Real rows
    // routinely differ (author row, media, reactions), so the first landing can
    // sit short of the anchor. Re-apply the target while items above it are
    // still being measured - nothing else re-issues the scroll, because the
    // correction effect above only reacts to `viewOffset` changing, not to
    // measurement.
    const handleItemSizeChanged = React.useCallback(
      ({
        index,
        size,
        previous,
      }: {
        index: number;
        size: number;
        previous: number;
      }) => {
        if (
          anchorSettledRef.current ||
          userHasScrolledRef.current ||
          !didStartInitialScrollRef.current ||
          size === previous
        ) {
          return;
        }

        const target = latestAnchorPositionRef.current;
        // Only sizes at or above the anchor move its offset.
        if (!target || target === 'end' || index > target.index) {
          return;
        }

        void applyAnchorPosition().catch(() => {
          // The list can unmount while a correction is in flight.
        });
      },
      [applyAnchorPosition]
    );

    React.useEffect(() => {
      return () => {
        if (settleTimerRef.current) {
          clearTimeout(settleTimerRef.current);
        }
      };
    }, []);

    React.useImperativeHandle(
      forwardedRef,
      (): PostListMethods => ({
        scrollToStart: (opts) =>
          void listRef.current?.scrollToOffset({
            offset: 0,
            animated: opts.animated,
          }),
        scrollToEnd: (opts) =>
          void listRef.current?.scrollToEnd({ animated: opts.animated }),
        scrollToPost: ({ postId, animated, viewPosition }) => {
          const index = postsWithNeighbors.findIndex(
            ({ post }) => post.id === postId
          );
          if (index === -1) {
            return;
          }

          void listRef.current?.scrollToIndex({
            index,
            animated,
            viewPosition,
          });
        },
      }),
      [postsWithNeighbors]
    );

    return (
      <AnimatedLegendList<PostWithNeighbors>
        // Explicit anchors intentionally remount when they resolve because
        // LegendList only honors its initial target during mount.
        key={listMountKey}
        ref={listRef}
        dataKey={channel.id}
        data={postsWithNeighbors}
        keyExtractor={getPostId}
        renderItem={renderItem}
        getItemType={({ post }) => post.type}
        estimatedItemSize={ESTIMATED_ITEM_SIZE}
        // Chat rows are stateful and highly variable-height; recycling them can
        // briefly reuse stale row state and measurements for another post.
        recycleItems={!anchorToEnd}
        alignItemsAtEnd={anchorToEnd}
        initialScrollAtEnd={
          anchorToEnd &&
          isInitialAnchorReady &&
          initialScrollIndex === undefined
        }
        initialScrollIndex={initialScrollIndex}
        maintainScrollAtEnd={anchorToEnd}
        maintainScrollAtEndThreshold={anchorToEnd ? 0.1 : undefined}
        maintainVisibleContentPosition={
          collectionLayout.shouldMaintainVisibleContentPosition || undefined
        }
        ListEmptyComponent={renderEmptyComponent}
        ListHeaderComponent={listHeaderComponent}
        ListFooterComponent={listBottomComponent}
        contentContainerStyle={contentContainerStyle}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'never' : undefined
        }
        scrollIndicatorInsets={{ top: 0, bottom: insets.bottom }}
        automaticallyAdjustsScrollIndicatorInsets={false}
        keyboardDismissMode="on-drag"
        scrollEnabled={scrollEnabled}
        style={[
          { flex: 1 },
          style,
          isInitialAnchorReady ? undefined : { opacity: 0 },
        ]}
        onLayout={(event) => {
          setViewportHeight(event.nativeEvent.layout.height);
        }}
        onLoad={handleLoad}
        onItemSizeChanged={handleItemSizeChanged}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          userHasScrolledRef.current = true;
          anchorSettledRef.current = true;
        }}
        onStartReached={onStartReached}
        onStartReachedThreshold={onStartReachedThreshold}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
      />
    );
  }
);

ConversationPostList.displayName = 'ConversationPostList';
