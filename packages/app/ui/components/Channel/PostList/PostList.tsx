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
} from './postListInitialization';
import {
  PostListComponent,
  PostListMethods,
  PostWithNeighbors,
  usePostListBottomCallbacks,
  usesConversationPostList,
} from './shared';

const ANCHOR_RESOLUTION_TIMEOUT_MS = 2_000;
const ESTIMATED_ITEM_SIZE = 120;

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
 * system. Initial positioning has three phases: use estimates at mount, apply
 * the exact position after initial layout, then correct for content changes
 * until the user scrolls.
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
    const initialScrollFrameRef = React.useRef<number | undefined>(undefined);
    const userHasScrolledRef = React.useRef(false);
    const appliedAnchorPositionRef = React.useRef<AnchorPosition | undefined>(
      undefined
    );
    const [didFinishInitialScroll, setDidFinishInitialScroll] =
      React.useState(false);
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

    const currentAnchorKeyRef = React.useRef(anchorKey);
    React.useLayoutEffect(() => {
      if (currentAnchorKeyRef.current === anchorKey) {
        return;
      }

      currentAnchorKeyRef.current = anchorKey;
      setTimedOutAnchorId(null);
    }, [anchorKey]);

    const currentListMountKeyRef = React.useRef(listMountKey);
    React.useLayoutEffect(() => {
      if (currentListMountKeyRef.current === listMountKey) {
        return;
      }

      currentListMountKeyRef.current = listMountKey;
      didStartInitialScrollRef.current = false;
      if (initialScrollFrameRef.current !== undefined) {
        cancelAnimationFrame(initialScrollFrameRef.current);
        initialScrollFrameRef.current = undefined;
      }
      setDidFinishInitialScroll(false);
      userHasScrolledRef.current = false;
      appliedAnchorPositionRef.current = undefined;
    }, [listMountKey]);

    React.useEffect(() => {
      const anchorId = anchor?.postId;
      if (!shouldStartAnchorTimeout || !anchorId) {
        return;
      }

      // Query failures switch ChannelScreen back to newest mode. A cache-backed
      // query can appear settled while its around-cursor fetch and cache updates
      // are still arriving, so wait briefly before falling back here.
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
    const anchorPosition: AnchorPosition | undefined =
      anchorToEnd && (!anchor?.postId || didTimeoutWaitingForAnchor)
        ? 'end'
        : initialScrollIndex;
    const latestAnchorPositionRef = React.useRef<AnchorPosition | undefined>(
      anchorPosition
    );
    React.useLayoutEffect(() => {
      latestAnchorPositionRef.current = anchorPosition;
    }, [anchorPosition]);

    // LegendList uses initialScrollIndex to get near the target from estimates.
    // Once it has measured the initial rows, this applies the exact position.
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
    const finishInitialScroll = React.useCallback(() => {
      setDidFinishInitialScroll(true);
      onInitialScrollCompleted?.();
    }, [onInitialScrollCompleted]);
    const completeInitialScroll = React.useCallback(() => {
      if (!isInitialAnchorReady || didStartInitialScrollRef.current) {
        return;
      }
      didStartInitialScrollRef.current = true;
      const loadedListMountKey = listMountKey;
      void applyAnchorPosition()
        .then(() => {
          if (currentListMountKeyRef.current !== loadedListMountKey) {
            return;
          }
          finishInitialScroll();
        })
        .catch(() => {
          // Navigation can cancel the scroll while the list is unmounting.
        });
    }, [
      applyAnchorPosition,
      finishInitialScroll,
      isInitialAnchorReady,
      listMountKey,
    ]);
    // LegendList has no settled-layout callback: onLoad fires before its
    // next-frame buffer expansion, so wait through two layout opportunities
    // before applying the exact target from measured row sizes.
    const scheduleInitialScroll = React.useCallback(() => {
      if (initialScrollFrameRef.current !== undefined) {
        cancelAnimationFrame(initialScrollFrameRef.current);
      }
      initialScrollFrameRef.current = requestAnimationFrame(() => {
        initialScrollFrameRef.current = requestAnimationFrame(() => {
          initialScrollFrameRef.current = undefined;
          completeInitialScroll();
        });
      });
    }, [completeInitialScroll]);
    React.useEffect(
      () => () => {
        if (initialScrollFrameRef.current !== undefined) {
          cancelAnimationFrame(initialScrollFrameRef.current);
        }
      },
      []
    );
    React.useEffect(() => {
      if (
        !isInitialAnchorReady ||
        isLoading ||
        postsWithNeighbors.length !== 0 ||
        didStartInitialScrollRef.current
      ) {
        return;
      }

      // LegendList defers onLoad when initialScrollAtEnd has no data to target.
      // A settled empty conversation has no position to reconcile, so reveal it.
      didStartInitialScrollRef.current = true;
      finishInitialScroll();
    }, [
      finishInitialScroll,
      isInitialAnchorReady,
      isLoading,
      postsWithNeighbors.length,
    ]);

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
        // The list may unmount while a later anchor correction is in flight.
      });
    }, [anchorPosition, applyAnchorPosition, didFinishInitialScroll]);

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
          isInitialAnchorReady && didFinishInitialScroll
            ? undefined
            : { opacity: 0 },
        ]}
        onLoad={scheduleInitialScroll}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          userHasScrolledRef.current = true;
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
