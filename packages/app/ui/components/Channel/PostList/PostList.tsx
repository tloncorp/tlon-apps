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
  getPostListScopeKey,
} from './postListInitialization';
import {
  PostListComponent,
  PostListComponentProps,
  PostListMethods,
  PostWithNeighbors,
  usePostListBottomCallbacks,
  usesConversationPostList,
} from './shared';

const ANCHOR_RESOLUTION_TIMEOUT_MS = 2_000;
const ESTIMATED_ITEM_SIZE = 120;

function useLegendListIsNearEnd(
  listRef: React.RefObject<LegendListRef | null>
) {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) =>
      listRef.current?.getState().listen('isNearEnd', onStoreChange) ??
      (() => {}),
    [listRef]
  );
  const getSnapshot = React.useCallback(
    () => listRef.current?.getState().isNearEnd ?? true,
    [listRef]
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

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
      <PostListFlatList
        // FlatList rows may retain their layouts when selection changes, so a
        // fresh selected anchor needs a fresh measurement/scroll attempt.
        key={props.anchor?.type === 'selected' ? props.anchor.postId : undefined}
        {...props}
        ref={forwardedRef}
      />
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
  (props, forwardedRef) => {
    const initialization = useConversationListInitialization(props);
    const { onInitialScrollPending } = props;
    const attemptRef = React.useRef<PostListMethods>(null);
    React.useLayoutEffect(() => {
      onInitialScrollPending?.();
    }, [initialization.mountKey, onInitialScrollPending]);
    React.useImperativeHandle(
      forwardedRef,
      () => ({
        scrollToStart: (options) => attemptRef.current?.scrollToStart(options),
        scrollToEnd: (options) => attemptRef.current?.scrollToEnd(options),
        scrollToPost: (options) => attemptRef.current?.scrollToPost(options),
      }),
      []
    );

    return (
      <ConversationPostListAttempt
        // Each resolution gets a fresh positioning attempt. This keeps its
        // refs and reveal state scoped to the same key that remounts the list.
        key={initialization.mountKey}
        {...props}
        {...initialization}
        ref={attemptRef}
      />
    );
  }
);
ConversationPostList.displayName = 'ConversationPostList';

type ConversationListInitialization = {
  anchorIndex: number;
  didTimeoutWaitingForAnchor: boolean;
  isInitialAnchorReady: boolean;
  mountKey: string;
};

function useConversationListInitialization({
  anchor,
  channel,
  isLoading = false,
  postsWithNeighbors,
}: Pick<
  PostListComponentProps,
  'anchor' | 'channel' | 'isLoading' | 'postsWithNeighbors'
>): ConversationListInitialization {
  const anchorIndex = React.useMemo(() => {
    if (!anchor?.postId) {
      return -1;
    }

    return postsWithNeighbors.findIndex(
      ({ post }) => post.id === anchor.postId
    );
  }, [anchor?.postId, postsWithNeighbors]);
  const anchorKey = getPostListAnchorKey(anchor);
  const anchorScopeKey = getPostListScopeKey(channel.id, anchor);
  const [timedOutAnchorScopeKey, setTimedOutAnchorScopeKey] = React.useState<
    string | null
  >(null);
  const didTimeoutWaitingForAnchor = timedOutAnchorScopeKey === anchorScopeKey;
  const {
    mountKey: anchorResolutionMountKey,
    isAnchorReady: isInitialAnchorReady,
    shouldStartAnchorTimeout,
  } = getPostListInitialization({
    anchorKey,
    anchorIndex,
    didTimeoutWaitingForAnchor,
    isLoading,
  });

  React.useEffect(() => {
    if (!shouldStartAnchorTimeout) {
      return;
    }

    // Query failures switch ChannelScreen back to newest mode. A cache-backed
    // query can appear settled while its around-cursor fetch and cache updates
    // are still arriving, so wait briefly before falling back here.
    const timeout = setTimeout(() => {
      setTimedOutAnchorScopeKey(anchorScopeKey);
    }, ANCHOR_RESOLUTION_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [anchorScopeKey, shouldStartAnchorTimeout]);

  React.useLayoutEffect(() => {
    setTimedOutAnchorScopeKey(null);
  }, [anchorScopeKey]);

  return {
    anchorIndex,
    didTimeoutWaitingForAnchor,
    isInitialAnchorReady,
    mountKey: `${channel.id}:${anchorResolutionMountKey}`,
  };
}

type ConversationPostListAttemptProps = PostListComponentProps &
  ConversationListInitialization;

function useConversationAnchorTarget({
  anchor,
  anchorIndex,
  anchorToEnd,
  didTimeoutWaitingForAnchor,
  listRef,
}: Pick<
  ConversationPostListAttemptProps,
  'anchor' | 'anchorIndex' | 'anchorToEnd' | 'didTimeoutWaitingForAnchor'
> & {
  listRef: React.RefObject<LegendListRef | null>;
}) {
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
  const latestAnchorPositionRef = React.useRef(anchorPosition);
  const appliedAnchorPositionRef = React.useRef<AnchorPosition | undefined>(
    undefined
  );

  React.useLayoutEffect(() => {
    latestAnchorPositionRef.current = anchorPosition;
  }, [anchorPosition]);

  // LegendList uses initialScrollIndex to get near the target from estimates.
  // Once it has measured the initial rows, this applies the exact position.
  const applyAnchorPosition = React.useCallback(async () => {
    const target = latestAnchorPositionRef.current;
    if (target === 'end') {
      await listRef.current?.scrollToEnd({ animated: false });
      appliedAnchorPositionRef.current = target;
      return true;
    }

    if (!target) {
      return false;
    }

    await listRef.current?.scrollToIndex({ ...target, animated: false });
    appliedAnchorPositionRef.current = target;
    return true;
  }, [listRef]);

  return {
    anchorPosition,
    appliedAnchorPositionRef,
    applyAnchorPosition,
    initialScrollIndex,
  };
}

function useInitialConversationScroll({
  anchorTarget,
  isInitialAnchorReady,
  isLoading,
  itemCount,
  onInitialScrollCompleted,
}: {
  anchorTarget: ReturnType<typeof useConversationAnchorTarget>;
  isInitialAnchorReady: boolean;
  isLoading: boolean;
  itemCount: number;
  onInitialScrollCompleted?: () => void;
}) {
  const attemptIsActiveRef = React.useRef(true);
  const didStartInitialScrollRef = React.useRef(false);
  const initialScrollFrameRef = React.useRef<number | undefined>(undefined);
  const userHasScrolledRef = React.useRef(false);
  const [hasUserScrolled, setHasUserScrolled] = React.useState(false);
  const [didFinishInitialScroll, setDidFinishInitialScroll] =
    React.useState(false);
  const { anchorPosition, appliedAnchorPositionRef, applyAnchorPosition } =
    anchorTarget;

  const finishInitialScroll = React.useCallback(() => {
    setDidFinishInitialScroll(true);
    onInitialScrollCompleted?.();
  }, [onInitialScrollCompleted]);
  const completeInitialScroll = React.useCallback(() => {
    if (!isInitialAnchorReady || didStartInitialScrollRef.current) {
      return;
    }
    didStartInitialScrollRef.current = true;
    void applyAnchorPosition()
      .then(() => {
        if (attemptIsActiveRef.current) {
          finishInitialScroll();
        }
      })
      .catch(() => {
        // A same-mount measurement race must not leave the list hidden. Reveal
        // the estimated position; the correction effect gets one exact retry.
        if (attemptIsActiveRef.current) {
          finishInitialScroll();
        }
      });
  }, [applyAnchorPosition, finishInitialScroll, isInitialAnchorReady]);

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

  React.useLayoutEffect(() => {
    attemptIsActiveRef.current = true;
    return () => {
      attemptIsActiveRef.current = false;
      if (initialScrollFrameRef.current !== undefined) {
        cancelAnimationFrame(initialScrollFrameRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (
      !isInitialAnchorReady ||
      isLoading ||
      itemCount !== 0 ||
      didStartInitialScrollRef.current
    ) {
      return;
    }

    // LegendList defers onLoad when initialScrollAtEnd has no data to target.
    // A settled empty conversation has no position to reconcile, so reveal it.
    didStartInitialScrollRef.current = true;
    finishInitialScroll();
  }, [finishInitialScroll, isInitialAnchorReady, isLoading, itemCount]);

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
  }, [
    anchorPosition,
    appliedAnchorPositionRef,
    applyAnchorPosition,
    didFinishInitialScroll,
  ]);

  const markUserScrolled = React.useCallback(() => {
    userHasScrolledRef.current = true;
    setHasUserScrolled(true);
  }, []);

  return {
    didFinishInitialScroll,
    hasUserScrolled,
    markUserScrolled,
    scheduleInitialScroll,
  };
}

const ConversationPostListAttempt = React.forwardRef<
  PostListMethods,
  ConversationPostListAttemptProps
>(
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
      hasNewerPosts = false,
      anchorIndex,
      didTimeoutWaitingForAnchor,
      isInitialAnchorReady,
    },
    forwardedRef
  ) => {
    const listRef = React.useRef<LegendListRef>(null);
    const insets = useSafeAreaInsets();
    const collectionLayout = React.useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const anchorTarget = useConversationAnchorTarget({
      anchor,
      anchorIndex,
      anchorToEnd,
      didTimeoutWaitingForAnchor,
      listRef,
    });
    const {
      didFinishInitialScroll,
      hasUserScrolled,
      markUserScrolled,
      scheduleInitialScroll,
    } = useInitialConversationScroll({
      anchorTarget,
      isInitialAnchorReady,
      isLoading,
      itemCount: postsWithNeighbors.length,
      onInitialScrollCompleted,
    });
    const { initialScrollIndex } = anchorTarget;
    const { onScroll: handleScroll, isAtBottom: isWithinBottomThreshold } =
      useScrollDirectionTracker({
        atBottomThreshold: onScrolledToBottomThreshold,
        bottomAtEnd: true,
      });
    // LegendList recalculates this when scrolling, content, or row measurements
    // change. React Native onScroll can retain an intermediate value while the
    // initial anchor settles, briefly showing the scroll-to-bottom control.
    const isNearEnd = useLegendListIsNearEnd(listRef);
    // The list is hidden while its initial anchor settles, so do not publish
    // transient geometry that could show external scroll chrome first. Until
    // the first user-driven navigation, LegendList's settled state also guards
    // against a stale intermediate React Native scroll event.
    const isAtBottom =
      !didFinishInitialScroll ||
      (!hasUserScrolled && isNearEnd) ||
      isWithinBottomThreshold;
    usePostListBottomCallbacks(isAtBottom, {
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });

    React.useImperativeHandle(
      forwardedRef,
      (): PostListMethods => ({
        scrollToStart: (opts) => {
          markUserScrolled();
          void listRef.current?.scrollToOffset({
            offset: 0,
            animated: opts.animated,
          });
        },
        scrollToEnd: (opts) => {
          markUserScrolled();
          void listRef.current?.scrollToEnd({ animated: opts.animated });
        },
        scrollToPost: ({ postId, animated, viewPosition }) => {
          const index = postsWithNeighbors.findIndex(
            ({ post }) => post.id === postId
          );
          if (index === -1) {
            return;
          }

          markUserScrolled();
          void listRef.current?.scrollToIndex({
            index,
            animated,
            viewPosition,
          });
        },
      }),
      [markUserScrolled, postsWithNeighbors]
    );

    return (
      <AnimatedLegendList<PostWithNeighbors>
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
        maintainScrollAtEnd={anchorToEnd && !hasNewerPosts}
        maintainScrollAtEndThreshold={
          anchorToEnd && !hasNewerPosts ? 0.1 : undefined
        }
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
          isInitialAnchorReady &&
          (didFinishInitialScroll ||
            (isLoading && postsWithNeighbors.length === 0))
            ? undefined
            : { opacity: 0 },
        ]}
        onLoad={scheduleInitialScroll}
        onScroll={handleScroll}
        onScrollBeginDrag={markUserScrolled}
        onStartReached={onStartReached}
        onStartReachedThreshold={onStartReachedThreshold}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
      />
    );
  }
);

ConversationPostListAttempt.displayName = 'ConversationPostListAttempt';
