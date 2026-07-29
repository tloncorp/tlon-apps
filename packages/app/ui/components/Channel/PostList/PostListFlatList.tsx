import type {
  ColumnWrapperStyle,
  LegendListRef,
} from '@legendapp/list/react-native';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import { layoutForType } from '@tloncorp/shared';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScrollDirectionTracker } from '../../../contexts/scroll';
import {
  conversationNavigationBarHeight,
  conversationScrollViewNativeID,
} from '../../nativeScrollEdgeEffects';
import {
  getPostListMountKey,
  isPostListAnchorReady,
} from './postListInitialization';
import {
  PostListComponent,
  PostListMethods,
  PostWithNeighbors,
} from './shared';

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

/**
 * LegendList-backed implementation for every native PostList shape and the
 * web multi-column fallback. Inverted data is rendered upright so native
 * scroll-edge effects are not transformed with the list.
 */
export const PostList: PostListComponent = React.forwardRef(
  (
    {
      postsWithNeighbors,
      scrollEnabled = true,
      numColumns,
      inverted = false,
      contentContainerStyle,
      columnWrapperStyle,
      style,
      renderItem,
      renderEmptyComponent,
      onStartReached,
      onStartReachedThreshold,
      onEndReached,
      onEndReachedThreshold,
      anchor,
      channel,
      collectionLayoutType,
      onInitialScrollCompleted,
      onScrolledToBottom,
      onScrolledToBottomThreshold = 1,
      onScrolledAwayFromBottom,
      listHeaderComponent,
      listBottomComponent,
      topContentInset = 0,
    },
    forwardedRef
  ) => {
    const listRef = React.useRef<LegendListRef>(null);
    const didStartInitialScrollRef = React.useRef(false);
    const userHasScrolledRef = React.useRef(false);
    const appliedInitialIndexRef = React.useRef<number | undefined>(undefined);
    const appliedInitialViewOffsetRef = React.useRef<number | undefined>(
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
    const shouldMaintainVisibleContentPosition = React.useMemo(
      () =>
        layoutForType(collectionLayoutType)
          .shouldMaintainVisibleContentPosition,
      [collectionLayoutType]
    );
    const orderedPosts = React.useMemo(
      () => (inverted ? [...postsWithNeighbors].reverse() : postsWithNeighbors),
      [inverted, postsWithNeighbors]
    );
    const anchorIndex = React.useMemo(() => {
      if (!anchor?.postId) {
        return -1;
      }

      return orderedPosts.findIndex(({ post }) => post.id === anchor.postId);
    }, [anchor?.postId, orderedPosts]);
    const [timedOutAnchorId, setTimedOutAnchorId] = React.useState<
      string | null
    >(null);
    const didTimeoutWaitingForAnchor =
      !!anchor?.postId && timedOutAnchorId === anchor.postId;

    React.useEffect(() => {
      if (!anchor?.postId || anchorIndex !== -1 || didTimeoutWaitingForAnchor) {
        return;
      }

      const anchorId = anchor.postId;
      const timeout = setTimeout(() => {
        setTimedOutAnchorId(anchorId);
      }, ANCHOR_RESOLUTION_TIMEOUT_MS);
      return () => clearTimeout(timeout);
    }, [anchor?.postId, anchorIndex, didTimeoutWaitingForAnchor]);

    const listMountKey = getPostListMountKey({
      postCount: orderedPosts.length,
      anchorId: anchor?.postId,
      anchorIndex,
      didTimeoutWaitingForAnchor,
    });
    const isInitialAnchorReady = isPostListAnchorReady({
      anchorId: anchor?.postId,
      anchorIndex,
      didTimeoutWaitingForAnchor,
    });
    const unreadAnchorViewOffset =
      Platform.OS === 'ios' && inverted
        ? insets.top + conversationNavigationBarHeight + topContentInset
        : 0;
    const initialScrollIndex = React.useMemo(
      () =>
        anchorIndex === -1 || didTimeoutWaitingForAnchor
          ? undefined
          : {
              index: anchorIndex,
              viewPosition:
                anchor?.type === 'unread' ? (inverted ? 0 : 1) : 0.5,
              viewOffset:
                anchor?.type === 'unread' ? unreadAnchorViewOffset : 0,
            },
      [
        anchor?.type,
        anchorIndex,
        didTimeoutWaitingForAnchor,
        inverted,
        unreadAnchorViewOffset,
      ]
    );
    const latestInitialScrollIndexRef = React.useRef(initialScrollIndex);
    latestInitialScrollIndexRef.current = initialScrollIndex;
    // Top-aligning the first unread is right when there is a run of unreads to
    // read down through. When the messages after the anchor cannot fill a
    // viewport, there is nothing below it but the composer spacer, so
    // top-aligning strands the view above the natural bottom - the user lands
    // short with content still to scroll. Land at the end instead.
    //
    // Defaults to false until the viewport is measured, so an unmeasured first
    // pass keeps the ordinary anchor behaviour rather than jumping to the end.
    const anchorIsNearViewportEnd =
      anchorIndex !== -1 &&
      viewportHeight > 0 &&
      (orderedPosts.length - 1 - anchorIndex) * ESTIMATED_ITEM_SIZE <
        viewportHeight;
    const anchorIsNearViewportEndRef = React.useRef(anchorIsNearViewportEnd);
    anchorIsNearViewportEndRef.current = anchorIsNearViewportEnd;

    /**
     * Applies the resolved anchor position, choosing between the anchor target
     * and the list end. Every path that positions the list on initial load goes
     * through here so they cannot disagree.
     */
    const applyAnchorPosition = React.useCallback(async () => {
      if (anchorIsNearViewportEndRef.current && inverted) {
        await listRef.current?.scrollToEnd({ animated: false });
        return true;
      }

      const target = latestInitialScrollIndexRef.current;
      if (!target) {
        return false;
      }

      appliedInitialIndexRef.current = target.index;
      appliedInitialViewOffsetRef.current = target.viewOffset;
      await listRef.current?.scrollToIndex({ ...target, animated: false });
      return true;
    }, [inverted]);
    const { onScroll: handleScroll, isAtBottom } = useScrollDirectionTracker({
      atBottomThreshold: onScrolledToBottomThreshold,
      bottomAtEnd: inverted,
    });
    React.useEffect(() => {
      if (isAtBottom) {
        onScrolledToBottom?.();
      } else {
        onScrolledAwayFromBottom?.();
      }
    }, [isAtBottom, onScrolledAwayFromBottom, onScrolledToBottom]);
    const resolvedColumnWrapperStyle = React.useMemo<
      ColumnWrapperStyle | undefined
    >(() => {
      if (numColumns <= 1) {
        return undefined;
      }

      const flattened = StyleSheet.flatten(columnWrapperStyle);
      return {
        gap: typeof flattened?.gap === 'number' ? flattened.gap : undefined,
        rowGap:
          typeof flattened?.rowGap === 'number' ? flattened.rowGap : undefined,
        columnGap:
          typeof flattened?.columnGap === 'number'
            ? flattened.columnGap
            : undefined,
      };
    }, [columnWrapperStyle, numColumns]);

    const handleLoad = React.useCallback(() => {
      if (!isInitialAnchorReady || didStartInitialScrollRef.current) {
        return;
      }
      didStartInitialScrollRef.current = true;

      const completeInitialScroll = async () => {
        try {
          // The around-anchor query can prepend cached history while
          // LegendList is bootstrapping. Re-resolve the current anchor index
          // before releasing queued edge events.
          await applyAnchorPosition();

          const updatedTarget = latestInitialScrollIndexRef.current;
          if (
            updatedTarget &&
            (updatedTarget.index !== appliedInitialIndexRef.current ||
              updatedTarget.viewOffset !== appliedInitialViewOffsetRef.current)
          ) {
            await applyAnchorPosition();
          }
        } catch {
          // Navigation can cancel the imperative scroll while unmounting.
        } finally {
          setDidFinishInitialScroll(true);
          onInitialScrollCompleted?.();
          settleTimerRef.current = setTimeout(() => {
            anchorSettledRef.current = true;
          }, ANCHOR_SETTLE_WINDOW_MS);
        }
      };

      void completeInitialScroll();
    }, [applyAnchorPosition, isInitialAnchorReady, onInitialScrollCompleted]);

    React.useEffect(() => {
      if (
        !didFinishInitialScroll ||
        userHasScrolledRef.current ||
        !initialScrollIndex ||
        initialScrollIndex.viewOffset === appliedInitialViewOffsetRef.current
      ) {
        return;
      }

      void applyAnchorPosition().catch(() => {
        // The list may unmount while the inset correction is in flight.
      });
    }, [applyAnchorPosition, didFinishInitialScroll, initialScrollIndex]);

    // The initial scroll offset is derived from `ESTIMATED_ITEM_SIZE`. Real rows
    // routinely differ (author row, media, reactions), so the first landing can
    // sit short of the anchor. Re-apply the target while items above it are
    // still being measured - nothing else re-issues the scroll, because the
    // correction effect above only reacts to `viewOffset` changing, not to
    // measurement.
    const handleItemSizeChanged = React.useCallback(
      ({ index, size, previous }: { index: number; size: number; previous: number }) => {
        if (
          anchorSettledRef.current ||
          userHasScrolledRef.current ||
          !didStartInitialScrollRef.current ||
          size === previous
        ) {
          return;
        }

        const target = latestInitialScrollIndexRef.current;
        // Only sizes at or above the anchor move its offset.
        if (!target || index > target.index) {
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
        scrollToStart: (opts) => {
          if (inverted) {
            void listRef.current?.scrollToEnd({ animated: opts.animated });
          } else {
            void listRef.current?.scrollToOffset({
              offset: 0,
              animated: opts.animated,
            });
          }
        },
        scrollToEnd: (opts) => {
          if (inverted) {
            void listRef.current?.scrollToOffset({
              offset: 0,
              animated: opts.animated,
            });
          } else {
            void listRef.current?.scrollToEnd({ animated: opts.animated });
          }
        },
        scrollToIndex: ({ index, animated, viewPosition }) => {
          const resolvedIndex = inverted
            ? orderedPosts.length - 1 - index
            : index;
          if (resolvedIndex < 0 || resolvedIndex >= orderedPosts.length) {
            return;
          }

          void listRef.current?.scrollToIndex({
            index: resolvedIndex,
            animated,
            viewPosition:
              inverted && viewPosition !== undefined
                ? 1 - viewPosition
                : viewPosition,
          });
        },
      }),
      [inverted, orderedPosts.length]
    );

    return (
      <AnimatedLegendList<PostWithNeighbors>
        key={listMountKey}
        ref={listRef}
        dataKey={channel.id}
        data={orderedPosts}
        keyExtractor={getPostId}
        renderItem={renderItem}
        getItemType={({ post }) => post.type}
        estimatedItemSize={120}
        recycleItems={!inverted}
        alignItemsAtEnd={inverted}
        initialScrollAtEnd={
          inverted && isInitialAnchorReady && initialScrollIndex === undefined
        }
        initialScrollIndex={initialScrollIndex}
        maintainScrollAtEnd={inverted}
        maintainScrollAtEndThreshold={inverted ? 0.1 : undefined}
        maintainVisibleContentPosition={
          shouldMaintainVisibleContentPosition || undefined
        }
        ListEmptyComponent={renderEmptyComponent}
        ListHeaderComponent={listHeaderComponent}
        ListFooterComponent={listBottomComponent}
        contentContainerStyle={contentContainerStyle}
        columnWrapperStyle={resolvedColumnWrapperStyle}
        numColumns={numColumns}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? (inverted ? 'never' : 'automatic') : undefined
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
        testID={
          inverted && numColumns === 1
            ? conversationScrollViewNativeID
            : undefined
        }
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
        onStartReached={inverted ? onEndReached : onStartReached}
        onStartReachedThreshold={
          inverted ? onEndReachedThreshold : onStartReachedThreshold
        }
        onEndReached={inverted ? onStartReached : onEndReached}
        onEndReachedThreshold={
          inverted ? onStartReachedThreshold : onEndReachedThreshold
        }
      />
    );
  }
);

PostList.displayName = 'PostList';
