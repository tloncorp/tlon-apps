import type * as db from '@tloncorp/shared/db';
import { KeyboardAwareLegendList } from '@legendapp/list/keyboard';
import { type LegendListRef } from '@legendapp/list/react-native';
import { layoutForType } from '@tloncorp/shared';
import * as React from 'react';
import { Platform, type ScrollView } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useConversationComposerHeight,
  useConversationScrollEndAnchor,
  useConversationScrollViewNativeID,
  useScrollDirectionTracker,
} from '../../../contexts/scroll';
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

// LegendList sizes rows it has not measured yet from a running average per
// item type. A single average for every chat post lets one long code block or
// wall of text inflate the estimate for everything, and each estimated row
// then shrinks when it measures, so the list creeps for seconds after a page
// of history loads. Bucketing by rough content size keeps the averages close
// to the rows they stand in for.
function getPostSizeClass(post: db.Post): string {
  if (post.hasImage) {
    return `${post.type}:image`;
  }
  const textLength = post.textContent?.length ?? 0;
  const sizeClass =
    textLength > 600
      ? 'xl'
      : textLength > 200
        ? 'l'
        : textLength > 60
          ? 'm'
          : 's';
  return `${post.type}:${sizeClass}`;
}

function useConversationKeyboardListProps(
  composerContentInset: SharedValue<number>
) {
  return React.useMemo(() => {
    if (Platform.OS === 'ios') {
      // iOS keeps the viewport fixed, so the list owns keyboard and composer
      // insets and commits them with the preserving content offset.
      return {
        contentInsetEndAdjustment: composerContentInset,
        freeze: false,
        keyboardDismissMode: 'interactive' as const,
      };
    }

    // Android adjustResize already shrinks the viewport. Freeze the library's
    // inset path so it does not count the keyboard twice.
    return {
      contentInsetEndAdjustment: undefined,
      freeze: true,
      keyboardDismissMode: 'on-drag' as const,
    };
  }, [composerContentInset]);
}

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

function runImperativeScroll(scroll: () => Promise<void> | undefined) {
  const attempt = () => {
    try {
      return scroll() ?? Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  void attempt().catch(() => {
    // LegendList can reject while data or measurements are changing. Retry
    // once after the next layout opportunity and contain a second failure.
    requestAnimationFrame(() => {
      void attempt().catch(() => {});
    });
  });
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
        key={
          props.anchor?.type === 'selected' ? props.anchor.postId : undefined
        }
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
  contentInsets,
  didTimeoutWaitingForAnchor,
  listRef,
}: Pick<
  ConversationPostListAttemptProps,
  | 'anchor'
  | 'anchorIndex'
  | 'anchorToEnd'
  | 'contentInsets'
  | 'didTimeoutWaitingForAnchor'
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
            viewOffset:
              anchor?.type === 'unread' ? (contentInsets?.top ?? 0) : 0,
          },
    [anchor?.type, anchorIndex, contentInsets?.top, didTimeoutWaitingForAnchor]
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
      contentInsets = { top: 0, bottom: 0 },
      isLoading = false,
      hasNewerPosts = false,
      anchorIndex,
      didTimeoutWaitingForAnchor,
      isInitialAnchorReady,
    },
    forwardedRef
  ) => {
    const listRef = React.useRef<LegendListRef>(null);
    const composerContentInset = useSharedValue(0);
    const conversationKeyboardListProps =
      useConversationKeyboardListProps(composerContentInset);
    const { register: registerConversationComposerHeight } =
      useConversationComposerHeight();
    const postsWithNeighborsRef = React.useRef(postsWithNeighbors);
    const scrollViewNativeID = useConversationScrollViewNativeID();
    const insets = useSafeAreaInsets();
    const collectionLayout = React.useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const reportConversationComposerHeight = React.useCallback(
      (height: number) => {
        composerContentInset.set(height);
        listRef.current?.reportContentInset({ bottom: height });
      },
      [composerContentInset]
    );
    React.useLayoutEffect(() => {
      if (Platform.OS !== 'ios') {
        return;
      }
      return registerConversationComposerHeight(
        reportConversationComposerHeight
      );
    }, [registerConversationComposerHeight, reportConversationComposerHeight]);
    const anchorTarget = useConversationAnchorTarget({
      anchor,
      anchorIndex,
      anchorToEnd,
      contentInsets,
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
    React.useLayoutEffect(() => {
      postsWithNeighborsRef.current = postsWithNeighbors;
    }, [postsWithNeighbors]);
    // Nothing else re-anchors an empty conversation: LegendList skips its end
    // alignment and maintainScrollAtEnd without rows, and the composer inset
    // reaction can run before the scroll view has reported its size. Rest the
    // empty content at its end (offset 0, or the keyboard height while one is
    // open) whenever its frame or content size settles.
    const settleEmptyConversationAtEnd = React.useCallback(() => {
      if (postsWithNeighborsRef.current.length > 0) {
        return;
      }
      // LegendList types the native ref as the bare ScrollView component class;
      // at runtime it is the ScrollView instance with its scroll methods.
      const scrollView = listRef.current?.getNativeScrollRef() as
        | ScrollView
        | undefined;
      scrollView?.scrollToEnd({ animated: false });
    }, []);
    const { onScroll: handleScroll, isAtBottom: isWithinBottomThreshold } =
      useScrollDirectionTracker({
        atBottomThreshold: onScrolledToBottomThreshold,
        bottomAtEnd: true,
      });
    // LegendList re-anchors the end whenever the list's layout, rows, or
    // footer change size, and it does so even mid-gesture. On Android a drag
    // dismisses the keyboard, which resizes the list and the composer while
    // the finger is still down, so the list would snap back to the end under
    // the user's scroll. Suspend end maintenance until the gesture, including
    // its fling, has finished.
    const [isUserScrolling, setIsUserScrolling] = React.useState(false);
    const handleScrollBeginDrag = React.useCallback(() => {
      markUserScrolled();
      setIsUserScrolling(true);
    }, [markUserScrolled]);
    const handleScrollEndDrag = React.useCallback(() => {
      setIsUserScrolling(false);
    }, []);
    const handleMomentumScrollBegin = React.useCallback(() => {
      setIsUserScrolling(true);
    }, []);
    const handleMomentumScrollEnd = React.useCallback(() => {
      setIsUserScrolling(false);
    }, []);
    // Android emits no drag-end event for a cancelled touch, which would leave
    // end maintenance suspended until the next gesture.
    const handleTouchCancel = React.useCallback(() => {
      setIsUserScrolling(false);
    }, []);
    // Android chat lists pad the scroll container for the composer. LegendList
    // re-anchors the end of the list when data, rows, or its footer change
    // size, but not when the container's padding does, so a composer growing
    // line by line would cover the latest message. When the inset changes
    // while the list rests at the end, scroll back to the end once the new
    // padding has laid out. LegendList retargets its own initial scroll for
    // padding changes, so this only runs after the initial anchor settles.
    const composerInset = contentInsets.bottom;
    const composerInsetRef = React.useRef(composerInset);
    React.useLayoutEffect(() => {
      const previousInset = composerInsetRef.current;
      composerInsetRef.current = composerInset;
      const insetDelta = composerInset - previousInset;
      if (
        Platform.OS !== 'android' ||
        !anchorToEnd ||
        insetDelta === 0 ||
        !didFinishInitialScroll ||
        isUserScrolling
      ) {
        return;
      }
      const listState = listRef.current?.getState();
      if (!listState) {
        return;
      }
      // The list has already absorbed the new padding into its content size,
      // so the distance it reported before the change is the current
      // distance less the delta.
      const distanceFromEndBefore =
        listState.contentLength -
        listState.scroll -
        listState.scrollLength -
        insetDelta;
      if (distanceFromEndBefore > 1) {
        return;
      }
      const frame = requestAnimationFrame(() => {
        runImperativeScroll(() =>
          listRef.current?.scrollToEnd({ animated: false })
        );
      });
      return () => cancelAnimationFrame(frame);
    }, [anchorToEnd, composerInset, didFinishInitialScroll, isUserScrolling]);
    // LegendList recalculates this when scrolling, content, or row measurements
    // change. React Native onScroll can retain an intermediate value while the
    // initial anchor settles, briefly showing the scroll-to-bottom control.
    const isNearEnd = useLegendListIsNearEnd(listRef);
    const conversationScrollEndAnchor = useConversationScrollEndAnchor();
    const shouldRestoreEndAnchorRef = React.useRef(false);
    const endAnchorHandler = React.useMemo(
      () => ({
        capture: () => {
          shouldRestoreEndAnchorRef.current =
            listRef.current?.getState().isNearEnd ?? false;
        },
        restore: () => {
          if (!shouldRestoreEndAnchorRef.current) {
            return;
          }
          shouldRestoreEndAnchorRef.current = false;
          runImperativeScroll(() =>
            listRef.current?.scrollToEnd({ animated: false })
          );
        },
      }),
      []
    );
    React.useLayoutEffect(() => {
      if (!conversationScrollEndAnchor) {
        return;
      }
      return conversationScrollEndAnchor.register(endAnchorHandler);
    }, [conversationScrollEndAnchor, endAnchorHandler]);
    // The list is hidden while its initial anchor settles, so do not publish
    // transient geometry that could show external scroll chrome first. Until
    // the first user-driven navigation, LegendList's settled state also guards
    // against a stale intermediate React Native scroll event.
    const isAtBottom =
      !didFinishInitialScroll ||
      (!hasUserScrolled && isNearEnd) ||
      isWithinBottomThreshold;
    // Data anchoring and end anchoring choose different items to preserve.
    // Let end anchoring own updates while the conversation is being followed;
    // retain data anchoring only after the user has moved away from the end.
    // With no rows there is nothing to keep in view, and LegendList's default
    // size anchoring (left on by `undefined`) scrolls iOS by any top padding
    // change, which carried an empty conversation up by the header inset when
    // the transparent header reported its height after mount.
    const maintainVisibleContentPosition =
      postsWithNeighbors.length === 0
        ? false
        : collectionLayout.shouldMaintainVisibleContentPosition &&
            !(anchorToEnd && !hasNewerPosts && isNearEnd)
          ? true
          : undefined;
    usePostListBottomCallbacks(isAtBottom, {
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });

    React.useImperativeHandle(
      forwardedRef,
      (): PostListMethods => ({
        scrollToStart: (opts) => {
          markUserScrolled();
          runImperativeScroll(() =>
            listRef.current?.scrollToOffset({
              offset: 0,
              animated: opts.animated,
            })
          );
        },
        scrollToEnd: (opts) => {
          markUserScrolled();
          runImperativeScroll(() =>
            listRef.current?.scrollToEnd({ animated: opts.animated })
          );
        },
        scrollToPost: ({ postId, animated, viewPosition }) => {
          markUserScrolled();
          runImperativeScroll(() => {
            const index = postsWithNeighborsRef.current.findIndex(
              ({ post }) => post.id === postId
            );
            if (index === -1) {
              return undefined;
            }
            return listRef.current?.scrollToIndex({
              index,
              animated,
              viewPosition,
            });
          });
        },
      }),
      [markUserScrolled]
    );

    return (
      <KeyboardAwareLegendList<PostWithNeighbors>
        ref={listRef}
        dataKey={channel.id}
        data={postsWithNeighbors}
        keyExtractor={getPostId}
        renderItem={renderItem}
        getItemType={({ post }) => getPostSizeClass(post)}
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
        maintainScrollAtEnd={anchorToEnd && !hasNewerPosts && !isUserScrolling}
        // A2UI rows can change by more than a small fraction of the viewport.
        // Keep the normal chat end anchor across those remeasurements whenever
        // the list was within one viewport of the latest message. Far-away
        // history remains unaffected by the threshold.
        maintainScrollAtEndThreshold={
          anchorToEnd && !hasNewerPosts ? 1 : undefined
        }
        maintainVisibleContentPosition={maintainVisibleContentPosition}
        ListEmptyComponent={renderEmptyComponent}
        ListHeaderComponent={listHeaderComponent}
        ListFooterComponent={listBottomComponent}
        contentContainerStyle={contentContainerStyle}
        {...conversationKeyboardListProps}
        // Preserve older messages while browsing history, but keep the latest
        // message anchored as the keyboard or composer grows at the end.
        keyboardLiftBehavior="whenAtEnd"
        keyboardOffset={insets.bottom}
        scrollIndicatorInsets={{ top: 0, bottom: insets.bottom }}
        automaticallyAdjustsScrollIndicatorInsets={false}
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
        // The iOS v1 bridge discovers this underlying UIScrollView through the
        // React Native testID/accessibilityIdentifier mapping, then validates
        // the attachment at low frequency in case Screens replaces the view.
        testID={scrollViewNativeID}
        onLoad={scheduleInitialScroll}
        onLayout={settleEmptyConversationAtEnd}
        onContentSizeChange={settleEmptyConversationAtEnd}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollBegin={handleMomentumScrollBegin}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onTouchCancel={handleTouchCancel}
        onStartReached={onStartReached}
        onStartReachedThreshold={onStartReachedThreshold}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
      />
    );
  }
);

ConversationPostListAttempt.displayName = 'ConversationPostListAttempt';
