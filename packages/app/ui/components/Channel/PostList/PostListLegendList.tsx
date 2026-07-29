import type { LegendListRef } from '@legendapp/list/react-native';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import * as React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  conversationNavigationBarHeight,
  conversationScrollViewNativeID,
} from '../../nativeScrollEdgeEffects';
import {
  getExplicitChatListMountKey,
  isExplicitChatAnchorReady,
} from './explicitChatListInitialization';
import {
  PostListComponent,
  PostListMethods,
  PostWithNeighbors,
  getPostId,
  usePostListBottomTracking,
} from './shared';

const ANCHOR_RESOLUTION_TIMEOUT_MS = 2_000;

export const PostList: PostListComponent = React.forwardRef(
  (
    {
      postsWithNeighbors,
      scrollEnabled = true,
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
    const insets = useSafeAreaInsets();
    const orderedPosts = React.useMemo(
      () => [...postsWithNeighbors].reverse(),
      [postsWithNeighbors]
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

    const unresolvedListMountKey = getExplicitChatListMountKey({
      enabled: true,
      postCount: orderedPosts.length,
      anchorId: anchor?.postId,
      anchorIndex,
    });
    const listMountKey = didTimeoutWaitingForAnchor
      ? `anchor:${anchor.postId}:fallback`
      : unresolvedListMountKey;
    const isInitialAnchorReady = isExplicitChatAnchorReady({
      anchorId: anchor?.postId,
      anchorIndex,
      didTimeoutWaitingForAnchor,
    });
    const unreadAnchorViewOffset =
      Platform.OS === 'ios'
        ? insets.top + conversationNavigationBarHeight + topContentInset
        : 0;
    const initialScrollIndex = React.useMemo(
      () =>
        anchorIndex === -1 || didTimeoutWaitingForAnchor
          ? undefined
          : {
              index: anchorIndex,
              viewPosition: anchor?.type === 'unread' ? 0 : 0.5,
              viewOffset:
                anchor?.type === 'unread' ? unreadAnchorViewOffset : 0,
            },
      [
        anchor?.type,
        anchorIndex,
        didTimeoutWaitingForAnchor,
        unreadAnchorViewOffset,
      ]
    );
    const latestInitialScrollIndexRef = React.useRef(initialScrollIndex);
    latestInitialScrollIndexRef.current = initialScrollIndex;
    const { onScroll: handleScroll } = usePostListBottomTracking({
      atBottomThreshold: onScrolledToBottomThreshold,
      bottomAtEnd: true,
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });

    const handleLoad = React.useCallback(() => {
      if (!isInitialAnchorReady || didStartInitialScrollRef.current) {
        return;
      }
      didStartInitialScrollRef.current = true;

      const completeInitialScroll = async () => {
        try {
          // The around-anchor query can prepend cached history while
          // LegendList is bootstrapping. Re-resolve the current anchor index
          // before releasing the queued edge events so the estimate from the
          // first data window cannot become the visible position.
          const initialTarget = latestInitialScrollIndexRef.current;
          if (initialTarget) {
            appliedInitialIndexRef.current = initialTarget.index;
            appliedInitialViewOffsetRef.current = initialTarget.viewOffset;
            await listRef.current?.scrollToIndex({
              ...initialTarget,
              animated: false,
            });
          }

          const updatedTarget = latestInitialScrollIndexRef.current;
          if (
            updatedTarget &&
            (updatedTarget.index !== appliedInitialIndexRef.current ||
              updatedTarget.viewOffset >
                (appliedInitialViewOffsetRef.current ?? 0))
          ) {
            appliedInitialIndexRef.current = updatedTarget.index;
            appliedInitialViewOffsetRef.current = updatedTarget.viewOffset;
            await listRef.current?.scrollToIndex({
              ...updatedTarget,
              animated: false,
            });
          }
        } catch {
          // Navigation can cancel the imperative scroll while this list is
          // unmounting. The bootstrap position remains the safe fallback.
        } finally {
          setDidFinishInitialScroll(true);
          onInitialScrollCompleted?.();
        }
      };

      void completeInitialScroll();
    }, [isInitialAnchorReady, onInitialScrollCompleted]);

    React.useEffect(() => {
      if (
        !didFinishInitialScroll ||
        userHasScrolledRef.current ||
        !initialScrollIndex ||
        initialScrollIndex.viewOffset <=
          (appliedInitialViewOffsetRef.current ?? 0)
      ) {
        return;
      }

      appliedInitialIndexRef.current = initialScrollIndex.index;
      appliedInitialViewOffsetRef.current = initialScrollIndex.viewOffset;
      const correction = listRef.current?.scrollToIndex({
        ...initialScrollIndex,
        animated: false,
      });
      void correction?.catch(() => {
        // The list may unmount while the inset correction is in flight.
      });
    }, [didFinishInitialScroll, initialScrollIndex]);

    React.useImperativeHandle(
      forwardedRef,
      (): PostListMethods => ({
        // Preserve the existing data-order semantics exposed by PostList:
        // source index 0 is the newest message, even though LegendList renders
        // the reversed data upright.
        scrollToStart: (opts) => {
          void listRef.current?.scrollToEnd({ animated: opts.animated });
        },
        scrollToEnd: (opts) => {
          void listRef.current?.scrollToOffset({
            offset: 0,
            animated: opts.animated,
          });
        },
        scrollToIndex: ({ index, animated, viewPosition }) => {
          const resolvedIndex = orderedPosts.length - 1 - index;
          if (resolvedIndex < 0 || resolvedIndex >= orderedPosts.length) {
            return;
          }

          void listRef.current?.scrollToIndex({
            index: resolvedIndex,
            animated,
            viewPosition:
              viewPosition === undefined ? undefined : 1 - viewPosition,
          });
        },
      }),
      [orderedPosts.length]
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
        recycleItems={false}
        alignItemsAtEnd
        initialScrollAtEnd={
          isInitialAnchorReady && initialScrollIndex === undefined
        }
        initialScrollIndex={initialScrollIndex}
        maintainScrollAtEnd
        maintainScrollAtEndThreshold={0.1}
        maintainVisibleContentPosition
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
        testID={conversationScrollViewNativeID}
        onLoad={handleLoad}
        onScroll={handleScroll}
        onScrollBeginDrag={() => {
          userHasScrolledRef.current = true;
        }}
        onStartReached={onEndReached}
        onStartReachedThreshold={onEndReachedThreshold}
        onEndReached={onStartReached}
        onEndReachedThreshold={onStartReachedThreshold}
      />
    );
  }
);

PostList.displayName = 'PostListLegendList';
