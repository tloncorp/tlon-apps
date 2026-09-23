import { KeyboardAwareLegendList } from '@legendapp/list/keyboard';
import { type LegendListRef } from '@legendapp/list/react-native';
import { AnimatedLegendList } from '@legendapp/list/reanimated';
import { layoutForType } from '@tloncorp/shared';
import * as React from 'react';
import {
  Platform,
  StyleSheet,
  type LayoutChangeEvent,
  type ScrollView,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  type SharedValue,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useConversationComposerHeight,
  useConversationScrollEndAnchor,
  useConversationScrollViewNativeID,
  useScrollDirectionTracker,
} from '../../../contexts/scroll';
import {
  useConversationComposerLayout,
  useIsConversationDocked,
} from '../ConversationLayout';
import { ConversationViewport } from '../ConversationViewport';
import { useFloatingComposer } from './useFloatingComposer';
import { PostList as PostListFlatList } from './PostListFlatList';
import { usePostArrivalAnimation } from './usePostArrivalAnimation';
import { useComposerSendTransition } from './useComposerSendTransition';
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

// Keep the native anchor attached across end-following and history modes.
// Toggling it during an iOS gesture can reuse a stale native anchor frame and
// jump to the start. LegendList still decides when data/size changes adjust it.
function renderConversationScrollView(
  props: ScrollViewProps & { ref?: React.Ref<ScrollView> }
) {
  return (
    <Animated.ScrollView
      {...props}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
    />
  );
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
        keyboardDismissMode: 'interactive' as const,
      };
    }

    return {
      contentInsetEndAdjustment: undefined,
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

function runImperativeScroll(
  scroll: () => Promise<void> | undefined,
  onSettled?: () => void
) {
  const attempt = () => {
    try {
      return scroll() ?? Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  void attempt().then(onSettled, () => {
    // LegendList can reject while data or measurements are changing. Retry
    // once after the next layout opportunity and contain a second failure.
    requestAnimationFrame(() => {
      void attempt()
        .catch(() => {})
        .then(onSettled);
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
    const docked = useIsConversationDocked();
    const composerLayout = useConversationComposerLayout();
    const floating = docked && composerLayout.floating;
    const historyNavigationRequested = React.useRef(false);
    const overlayHeight = floating ? composerLayout.height : 0;
    const listContentStyle = React.useMemo(
      () => [
        contentContainerStyle,
        // Let native layout bottom-align short conversations. LegendList's
        // default top spacer waits for JS onLayout on every keyboard frame.
        docked && anchorToEnd && Platform.OS === 'ios'
          ? { minHeight: '100%' as const }
          : undefined,
        overlayHeight
          ? {
              paddingBottom:
                ((StyleSheet.flatten(contentContainerStyle)
                  ?.paddingBottom as number) ?? 0) + overlayHeight,
            }
          : undefined,
      ],
      [anchorToEnd, contentContainerStyle, docked, overlayHeight]
    );
    const ConversationList = docked
      ? AnimatedLegendList
      : KeyboardAwareLegendList;
    const composerContentInset = useSharedValue(0);
    const conversationKeyboardListProps =
      useConversationKeyboardListProps(composerContentInset);
    const {
      register: registerConversationComposerHeight,
      registerSend: registerComposerSend,
    } = useConversationComposerHeight();
    const postsWithNeighborsRef = React.useRef(postsWithNeighbors);
    const scrollViewNativeID = useConversationScrollViewNativeID();
    const insets = useSafeAreaInsets();
    const reduceMotion = useReducedMotion();
    const collectionLayout = React.useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const applyConversationComposerHeight = React.useCallback(
      (height: number) => {
        // KeyboardAwareLegendList owns inset reporting, including the keyboard
        // height. This shared value only supplies the composer's contribution.
        composerContentInset.set(height);
      },
      [composerContentInset]
    );
    const {
      active: composerSendActive,
      begin: beginComposerSend,
      finish: finishComposerSend,
      isActive: isComposerSendActive,
      reportHeight: reportConversationComposerHeight,
      cancelFollowing: cancelComposerSendFollowing,
    } = useComposerSendTransition(
      listRef,
      applyConversationComposerHeight,
      (docked || Platform.OS === 'ios') &&
        !floating &&
        anchorToEnd &&
        !hasNewerPosts,
      !reduceMotion
    );
    React.useLayoutEffect(
      () =>
        registerComposerSend({
          begin: () => {
            historyNavigationRequested.current = false;
            beginComposerSend();
          },
          finish: finishComposerSend,
          isActive: isComposerSendActive,
        }),
      [
        beginComposerSend,
        finishComposerSend,
        isComposerSendActive,
        registerComposerSend,
      ]
    );
    React.useLayoutEffect(() => {
      if (docked || Platform.OS !== 'ios') {
        return;
      }
      return registerConversationComposerHeight(
        reportConversationComposerHeight
      );
    }, [
      docked,
      registerConversationComposerHeight,
      reportConversationComposerHeight,
    ]);
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
      markUserScrolled: markInitialUserScrolled,
      scheduleInitialScroll,
    } = useInitialConversationScroll({
      anchorTarget,
      isInitialAnchorReady,
      isLoading,
      itemCount: postsWithNeighbors.length,
      onInitialScrollCompleted,
    });
    const followsViewportEnd = React.useRef(false);
    const userNavigationActive = React.useRef(false);
    // Worklet scroll reports can reach JS after the drag-end callback. Retain
    // the navigation intent until a send or explicit return-to-end replaces it.
    const isBrowsingHistory = React.useCallback(
      () => historyNavigationRequested.current,
      []
    );
    const finishUserNavigation = React.useCallback(() => {
      userNavigationActive.current = false;
    }, []);
    const markUserScrolled = React.useCallback(() => {
      followsViewportEnd.current = false;
      userNavigationActive.current = true;
      historyNavigationRequested.current = true;
      cancelComposerSendFollowing();
      markInitialUserScrolled();
    }, [cancelComposerSendFollowing, markInitialUserScrolled]);
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
    const onScrollPositionChange = useFloatingComposer(
      listRef,
      docked,
      didFinishInitialScroll,
      isComposerSendActive,
      isBrowsingHistory,
      hasNewerPosts
    );
    const { onScroll: handleScroll, isAtBottom: isWithinBottomThreshold } =
      useScrollDirectionTracker({
        atBottomThreshold: onScrolledToBottomThreshold,
        bottomAtEnd: true,
        onScrollPositionChange: docked ? onScrollPositionChange : undefined,
      });
    // LegendList recalculates this when scrolling, content, or row measurements
    // change. React Native onScroll can retain an intermediate value while the
    // initial anchor settles, briefly showing the scroll-to-bottom control.
    const isNearEnd = useLegendListIsNearEnd(listRef);
    const renderAnimatedItem = usePostArrivalAnimation({
      posts: postsWithNeighbors,
      renderItem,
      enabled:
        anchorToEnd &&
        didFinishInitialScroll &&
        isNearEnd &&
        !isLoading &&
        !hasNewerPosts &&
        !reduceMotion,
    });
    const previousViewportHeight = React.useRef(0);
    const handleLayout = React.useCallback(
      (event: LayoutChangeEvent) => {
        const previousHeight = previousViewportHeight.current;
        const height = event.nativeEvent.layout.height;
        previousViewportHeight.current = height;
        settleEmptyConversationAtEnd();
        if (
          !docked ||
          Platform.OS === 'ios' ||
          floating ||
          !anchorToEnd ||
          hasNewerPosts ||
          !previousHeight ||
          height === previousHeight ||
          userNavigationActive.current ||
          isComposerSendActive()
        ) {
          return;
        }
        const state = listRef.current?.getState();
        // Compare against the OLD viewport: LegendList has already updated its
        // dimensions by the time it calls us. Resizing should only follow the
        // latest message, not use the wider threshold intended for incoming rows.
        if (state && state.contentLength - state.scroll - previousHeight <= 2) {
          followsViewportEnd.current = true;
        }
        // Native scroll events can trail consecutive layout frames. Retain
        // the end anchor until the user chooses a different reading position.
        if (followsViewportEnd.current) {
          const scrollView = listRef.current?.getNativeScrollRef() as
            | ScrollView
            | undefined;
          scrollView?.scrollToEnd({ animated: false });
        }
      },
      [
        anchorToEnd,
        docked,
        floating,
        hasNewerPosts,
        isComposerSendActive,
        settleEmptyConversationAtEnd,
      ]
    );
    const maintainScrollAtEnd = React.useMemo(
      () =>
        anchorToEnd && !floating && !hasNewerPosts && !composerSendActive
          ? {
              animated: didFinishInitialScroll && !reduceMotion,
              // The keyboard and composer already animate the viewport. Follow
              // each resize immediately instead of starting another animation.
              on: docked
                ? {
                    dataChange: true,
                    footerLayout: true,
                    itemLayout: true,
                    layout: false,
                  }
                : undefined,
            }
          : false,
      [
        anchorToEnd,
        composerSendActive,
        docked,
        floating,
        didFinishInitialScroll,
        hasNewerPosts,
        reduceMotion,
      ]
    );
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
    // Disable LegendList's data and size corrections while following the latest
    // posts. The iOS native anchor stays attached via our scroll renderer.
    // `undefined` still enables size anchoring: native MVCP can jump to the
    // new end before the animated scroll runs, particularly on Android.
    // History keeps its visible post anchored; empty lists have no post to
    // preserve as the header and composer settle.
    const maintainVisibleContentPosition =
      postsWithNeighbors.length === 0
        ? false
        : collectionLayout.shouldMaintainVisibleContentPosition &&
            !(
              anchorToEnd &&
              !hasNewerPosts &&
              ((!floating && isNearEnd) || composerSendActive)
            )
          ? true
          : false;
    usePostListBottomCallbacks(isAtBottom, {
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });

    React.useImperativeHandle(
      forwardedRef,
      (): PostListMethods => ({
        scrollToStart: (opts) => {
          markUserScrolled();
          runImperativeScroll(
            () =>
              listRef.current?.scrollToOffset({
                offset: 0,
                animated: opts.animated,
              }),
            finishUserNavigation
          );
        },
        scrollToEnd: (opts) => {
          markUserScrolled();
          historyNavigationRequested.current = false;
          runImperativeScroll(
            () => listRef.current?.scrollToEnd({ animated: opts.animated }),
            finishUserNavigation
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
          }, finishUserNavigation);
        },
      }),
      [finishUserNavigation, markUserScrolled]
    );

    const list = (
      <ConversationList<PostWithNeighbors>
        ref={listRef}
        renderScrollComponent={
          docked && Platform.OS === 'ios'
            ? renderConversationScrollView
            : undefined
        }
        dataKey={channel.id}
        data={postsWithNeighbors}
        keyExtractor={getPostId}
        renderItem={renderAnimatedItem}
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
        maintainScrollAtEnd={maintainScrollAtEnd}
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
        contentContainerStyle={listContentStyle}
        {...(docked
          ? {
              keyboardDismissMode:
                conversationKeyboardListProps.keyboardDismissMode,
            }
          : {
              ...conversationKeyboardListProps,
              keyboardLiftBehavior: composerSendActive
                ? ('never' as const)
                : ('whenAtEnd' as const),
              keyboardOffset: insets.bottom,
            })}
        // A docked list ends above the composer. The legacy iOS keyboard
        // wrapper supplies its own indicator clearance.
        scrollIndicatorInsets={{
          top: contentInsets.top,
          bottom: docked
            ? overlayHeight
            : Platform.OS === 'ios'
              ? 0
              : insets.bottom,
        }}
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
        onLayout={handleLayout}
        onContentSizeChange={settleEmptyConversationAtEnd}
        onScroll={handleScroll}
        onScrollBeginDrag={markUserScrolled}
        onScrollEndDrag={finishUserNavigation}
        onMomentumScrollBegin={() => {
          userNavigationActive.current = true;
        }}
        onMomentumScrollEnd={finishUserNavigation}
        onStartReached={onStartReached}
        onStartReachedThreshold={onStartReachedThreshold}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
      />
    );

    return (
      <ConversationViewport
        anchorToEnd={
          docked &&
          anchorToEnd &&
          !floating &&
          !hasNewerPosts &&
          !composerSendActive
        }
      >
        {list}
      </ConversationViewport>
    );
  }
);

ConversationPostListAttempt.displayName = 'ConversationPostListAttempt';
