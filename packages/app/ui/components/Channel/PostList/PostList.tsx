import { KeyboardAwareLegendList } from '@legendapp/list/keyboard';
import { ConversationListDiagnosticsContext } from './diagnostics';
import { type LegendListRef } from '@legendapp/list/react-native';
import { layoutForType } from '@tloncorp/shared';
import * as React from 'react';
import {
  PixelRatio,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import {
  type SharedValue,
  runOnJS,
  useAnimatedScrollHandler,
  useComposedEventHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeReadListContext } from '../../../contexts/nativeRead';
import { NativeReadScopeContainer } from '../../ScrollReadContainers';
import { useNativeReadScope } from './useNativeReadScope';

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
  InitialScrollRecovery,
  PostListComponent,
  PostListComponentProps,
  PostListMethods,
  PostWithNeighbors,
  usePostListBottomCallbacks,
  usesConversationPostList,
} from './shared';

import {
  createNativeScrollOwnership,
  isNativeScrollUnalignedError,
  nativeAnchorViewOffset,
  runOwnedNativeScroll as runOwnedNativeScrollWithRetry,
} from './nativeScrollOwnership';

const ANCHOR_RESOLUTION_TIMEOUT_MS = 2_000;
const ESTIMATED_ITEM_SIZE = 120;
type OwnedScroll = (
  isCurrent: () => boolean,
  scroll: () => Promise<void> | undefined
) => Promise<void> | undefined;

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

function missingPostTarget(postId: string) {
  return Object.assign(
    new Error('Post is no longer available for navigation'),
    {
      code: 'LEGEND_SCROLL_UNALIGNED',
      reason: 'target-missing',
      key: postId,
      index: null,
      requestedOffset: null,
      currentOffset: null,
      observedOffset: null,
    }
  );
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
        captureScrollIntent: () =>
          attemptRef.current?.captureScrollIntent?.() ?? (() => false),
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
  footerSize,
  itemCount,
  itemsRef,
  ownScroll,
}: Pick<
  ConversationPostListAttemptProps,
  | 'anchor'
  | 'anchorIndex'
  | 'anchorToEnd'
  | 'contentInsets'
  | 'didTimeoutWaitingForAnchor'
> & {
  listRef: React.RefObject<LegendListRef | null>;
  footerSize: number;
  itemCount: number;
  itemsRef: React.RefObject<PostWithNeighbors[]>;
  ownScroll: OwnedScroll;
}) {
  const initialScrollIndex = React.useMemo<IndexedAnchorPosition | undefined>(
    () =>
      anchorIndex === -1 || didTimeoutWaitingForAnchor
        ? undefined
        : {
            index: anchorIndex,
            viewPosition: anchor?.type === 'unread' ? 0 : 0.5,
            viewOffset: nativeAnchorViewOffset(
              contentInsets?.top ?? 0,
              contentInsets?.bottom ?? 0,
              anchor?.type === 'unread' ? 0 : 0.5,
              Platform.OS === 'ios',
              anchorIndex === itemCount - 1 ? footerSize : 0
            ),
          },
    [
      anchor?.type,
      anchorIndex,
      contentInsets?.top,
      contentInsets?.bottom,
      didTimeoutWaitingForAnchor,
      footerSize,
      itemCount,
    ]
  );
  const anchorPosition: AnchorPosition | undefined =
    anchorToEnd && (!anchor?.postId || didTimeoutWaitingForAnchor)
      ? 'end'
      : initialScrollIndex;
  const latestAnchorPositionRef = React.useRef({
    position: anchorPosition,
    postId: anchor?.postId,
  });
  const appliedAnchorPositionRef = React.useRef<AnchorPosition | undefined>(
    undefined
  );

  React.useLayoutEffect(() => {
    latestAnchorPositionRef.current = {
      position: anchorPosition,
      postId: anchor?.postId,
    };
  }, [anchorPosition, anchor?.postId]);

  // LegendList uses initialScrollIndex to get near the target from estimates.
  // Once it has measured the initial rows, this applies the exact position.
  const applyAnchorPosition = React.useCallback(
    async (isCurrent: () => boolean) => {
      if (!isCurrent()) return false;
      const { position: target, postId } = latestAnchorPositionRef.current;
      if (target === 'end') {
        await ownScroll(isCurrent, () =>
          listRef.current?.scrollToEnd({ animated: false })
        );
        if (!isCurrent()) return false;
        appliedAnchorPositionRef.current = target;
        return true;
      }

      if (!target) {
        return false;
      }

      if (Platform.OS === 'ios' && postId) {
        const item = itemsRef.current.find(({ post }) => post.id === postId);
        if (!item) throw missingPostTarget(postId);
        await ownScroll(isCurrent, () =>
          listRef.current?.scrollToItem({
            item,
            viewPosition: target.viewPosition,
            viewOffset: target.viewOffset,
            animated: false,
          })
        );
      } else {
        await ownScroll(isCurrent, () =>
          listRef.current?.scrollToIndex({ ...target, animated: false })
        );
      }
      if (!isCurrent()) return false;
      appliedAnchorPositionRef.current = target;
      return true;
    },
    [itemsRef, listRef, ownScroll]
  );

  return {
    anchorPosition,
    appliedAnchorPositionRef,
    applyAnchorPosition,
    initialScrollIndex,
  };
}

function useInitialConversationScroll({
  owner,
  captureIntent,
  anchorTarget,
  isInitialAnchorReady,
  isLoading,
  itemCount,
  isFocused,
  onInitialScrollCompleted,
  onInitialScrollRecoveryChange,
}: {
  owner: ReturnType<typeof createNativeScrollOwnership>;
  captureIntent: () => () => boolean;
  anchorTarget: ReturnType<typeof useConversationAnchorTarget>;
  isInitialAnchorReady: boolean;
  isLoading: boolean;
  itemCount: number;
  isFocused: boolean;
  onInitialScrollCompleted?: () => void;
  onInitialScrollRecoveryChange?: (
    recovery: InitialScrollRecovery | null
  ) => void;
}) {
  const attemptIsActiveRef = React.useRef(true);
  const didStartInitialScrollRef = React.useRef(false);
  const initialScrollFrameRef = React.useRef<number | undefined>(undefined);
  const initialScrollTicketRef = React.useRef<object | null>(null);
  const initialOperationRef = React.useRef<object | null>(null);
  const didNotifyReadyRef = React.useRef(false);
  const recoveryRef = React.useRef<{
    action: InitialScrollRecovery;
    retryCommand: () => void;
  } | null>(null);
  const retryInitialRef = React.useRef<(() => void) | null>(null);
  const clearRecovery = React.useCallback(() => {
    if (!recoveryRef.current) return;
    recoveryRef.current = null;
    onInitialScrollRecoveryChange?.(null);
  }, [onInitialScrollRecoveryChange]);
  const publishRecovery = React.useCallback(
    (retryCommand: () => void) => {
      const permit = captureIntent();
      const action: InitialScrollRecovery = {
        retry: () => {
          if (
            !attemptIsActiveRef.current ||
            recoveryRef.current?.action !== action ||
            !permit()
          )
            return;
          clearRecovery();
          retryCommand();
        },
      };
      recoveryRef.current = { action, retryCommand };
      onInitialScrollRecoveryChange?.(action);
    },
    [captureIntent, clearRecovery, onInitialScrollRecoveryChange]
  );
  const userHasScrolledRef = React.useRef(false);
  const [hasUserScrolled, setHasUserScrolled] = React.useState(false);
  const [didFinishInitialScroll, setDidFinishInitialScroll] =
    React.useState(false);
  const { anchorPosition, appliedAnchorPositionRef, applyAnchorPosition } =
    anchorTarget;

  const finishInitialScroll = React.useCallback(() => {
    if (!owner.capture()() || didNotifyReadyRef.current) return;
    if (!owner.finishNavigation()) return;
    didNotifyReadyRef.current = true;
    clearRecovery();
    setDidFinishInitialScroll(true);
    onInitialScrollCompleted?.();
  }, [owner, clearRecovery, onInitialScrollCompleted]);
  const finishUserNavigation = React.useCallback(() => {
    if (!owner.finishNavigation()) return;
    finishInitialScroll();
  }, [owner, finishInitialScroll]);
  const cancelInitialScroll = React.useCallback(() => {
    initialScrollTicketRef.current = null;
    initialOperationRef.current = null;
    if (initialScrollFrameRef.current !== undefined) {
      cancelAnimationFrame(initialScrollFrameRef.current);
      initialScrollFrameRef.current = undefined;
    }
  }, []);
  const handleScrollFailure = React.useCallback(
    (error: unknown, retryCommand: () => void) => {
      if (!attemptIsActiveRef.current || !owner.capture()()) return;
      if (!owner.finishNavigation()) return;
      if (didNotifyReadyRef.current) return;
      if (!isNativeScrollUnalignedError(error)) {
        // Preserve the existing ordinary measurement fallback; it is not an
        // acknowledgement of the failed indexed command.
        finishInitialScroll();
        return;
      }
      cancelInitialScroll();
      publishRecovery(retryCommand);
    },
    [cancelInitialScroll, finishInitialScroll, owner, publishRecovery]
  );
  const completeInitialScroll = React.useCallback(() => {
    if (!isInitialAnchorReady || didStartInitialScrollRef.current) {
      return;
    }
    didStartInitialScrollRef.current = true;
    clearRecovery();
    const operation = {};
    initialOperationRef.current = operation;
    const permit = captureIntent();
    const isCurrent = () =>
      permit() && initialOperationRef.current === operation;
    void applyAnchorPosition(isCurrent)
      .then(() => {
        if (attemptIsActiveRef.current && isCurrent()) {
          finishInitialScroll();
        }
      })
      .catch((error: unknown) => {
        if (attemptIsActiveRef.current && isCurrent()) {
          handleScrollFailure(error, () => retryInitialRef.current?.());
        }
      });
  }, [
    captureIntent,
    applyAnchorPosition,
    clearRecovery,
    finishInitialScroll,
    handleScrollFailure,
    isInitialAnchorReady,
  ]);

  // LegendList has no settled-layout callback: onLoad fires before its
  // next-frame buffer expansion, so wait through two layout opportunities
  // before applying the exact target from measured row sizes.
  const scheduleInitialScroll = React.useCallback(() => {
    if (didStartInitialScrollRef.current) return;
    cancelInitialScroll();
    const ticket = {};
    initialScrollTicketRef.current = ticket;
    const permit = captureIntent();
    const isCurrent = () =>
      permit() && initialScrollTicketRef.current === ticket;
    initialScrollFrameRef.current = requestAnimationFrame(() => {
      if (!isCurrent()) return;
      initialScrollFrameRef.current = requestAnimationFrame(() => {
        if (!isCurrent()) return;
        initialScrollFrameRef.current = undefined;
        initialScrollTicketRef.current = null;
        completeInitialScroll();
      });
    });
  }, [captureIntent, cancelInitialScroll, completeInitialScroll]);

  React.useLayoutEffect(() => {
    retryInitialRef.current = () => {
      owner.navigate(owner.getMode());
      didStartInitialScrollRef.current = false;
      userHasScrolledRef.current = false;
      setHasUserScrolled(false);
      scheduleInitialScroll();
    };
  }, [owner, scheduleInitialScroll]);

  React.useLayoutEffect(() => {
    const recovery = recoveryRef.current;
    if (isFocused && recovery) publishRecovery(recovery.retryCommand);
  }, [isFocused, publishRecovery]);

  React.useLayoutEffect(() => {
    attemptIsActiveRef.current = true;
    return () => {
      attemptIsActiveRef.current = false;
      didStartInitialScrollRef.current = false;
      didNotifyReadyRef.current = false;
      recoveryRef.current = null;
      cancelInitialScroll();
    };
  }, [cancelInitialScroll]);

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

    owner.navigate(owner.getMode());
    const isCurrent = captureIntent();
    void applyAnchorPosition(isCurrent)
      .finally(() => {
        if (isCurrent()) owner.finishNavigation();
      })
      .catch(() => {
        // The list may unmount while a later anchor correction is in flight.
      });
  }, [
    captureIntent,
    anchorPosition,
    appliedAnchorPositionRef,
    applyAnchorPosition,
    didFinishInitialScroll,
    owner,
  ]);

  const markUserScrolled = React.useCallback(
    (revealForDrag = false, preserveFailedEntry = false) => {
      const hadRecovery = recoveryRef.current !== null;
      cancelInitialScroll();
      if (!preserveFailedEntry) clearRecovery();
      didStartInitialScrollRef.current = true;
      userHasScrolledRef.current = true;
      setHasUserScrolled(true);
      // A drag already owns the exposed viewport. Imperative takeovers reveal
      // only after their own command settles, never through an obsolete anchor.
      if (revealForDrag && !(preserveFailedEntry && hadRecovery))
        finishInitialScroll();
    },
    [cancelInitialScroll, clearRecovery, finishInitialScroll]
  );

  return {
    didFinishInitialScroll,
    hasUserScrolled,
    markUserScrolled,
    finishUserNavigation,
    handleScrollFailure,
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
      isFocused = true,
      scrollVisit,
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
      targetLayouts,
      onInitialScrollCompleted,
      onInitialScrollRecoveryChange,
      onScrolledToBottom,
      onScrolledToBottomThreshold = 1,
      onScrolledAwayFromBottom,
      onScrollIntentChanged,
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
    const [owner] = React.useState(() =>
      createNativeScrollOwnership(
        anchorToEnd && (!anchor?.postId || didTimeoutWaitingForAnchor)
          ? 'follow'
          : 'read'
      )
    );
    React.useLayoutEffect(() => {
      owner.activate();
      return () => owner.dispose();
    }, [owner]);
    const ownership = React.useSyncExternalStore(
      owner.subscribe,
      owner.getSnapshot,
      owner.getSnapshot
    );
    const captureIntent = React.useCallback(() => {
      const intent = owner.capture();
      const visit = scrollVisit?.capture();
      return () => intent() && (visit?.() ?? true);
    }, [owner, scrollVisit]);
    const ownScroll = React.useCallback<OwnedScroll>(
      (isCurrent, scroll) => {
        const list = listRef.current;
        const request = scroll();
        if (request)
          owner.trackRequest(request, isCurrent, () =>
            list?.cancelScroll?.(request)
          );
        return request;
      },
      [owner]
    );
    React.useLayoutEffect(() => {
      owner.validateRequests();
    }, [owner, scrollVisit, isFocused]);
    const runOwnedNativeScroll = React.useCallback(
      (
        isCurrent: () => boolean,
        scroll: () => Promise<void> | undefined,
        schedule?: (callback: () => void) => unknown,
        onSettled?: () => void,
        onFailure?: (error: unknown) => void
      ) =>
        runOwnedNativeScrollWithRetry(
          isCurrent,
          () => ownScroll(isCurrent, scroll),
          schedule,
          onSettled,
          onFailure
        ),
      [ownScroll]
    );
    const canIssueCommand = React.useCallback(
      () =>
        isFocused && (scrollVisit?.isCurrent() ?? true) && owner.capture()(),
      [isFocused, scrollVisit, owner]
    );
    const isFollowing =
      isFocused && ownership.mode === 'follow' && anchorToEnd && !hasNewerPosts;
    const diagnostics = React.useContext(ConversationListDiagnosticsContext);
    const attachDiagnostics = diagnostics?.attach;
    const scrollViewNativeID = useConversationScrollViewNativeID();
    React.useEffect(() => {
      if (attachDiagnostics && listRef.current) {
        return attachDiagnostics(
          listRef.current,
          channel.id,
          scrollViewNativeID
        );
      }
    }, [attachDiagnostics, channel.id, scrollViewNativeID]);
    const composerContentInset = useSharedValue(0);
    const conversationKeyboardListProps =
      useConversationKeyboardListProps(composerContentInset);
    const { register: registerConversationComposerHeight } =
      useConversationComposerHeight();
    const postsWithNeighborsRef = React.useRef(postsWithNeighbors);
    const currentTargetInsets = React.useRef(contentInsets);
    React.useLayoutEffect(() => {
      currentTargetInsets.current = contentInsets;
    }, [contentInsets]);
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
    const [footerSize, setFooterSize] = React.useState(0);
    const footerSizeRef = React.useRef(0);
    const reportMetrics = React.useCallback(
      (metrics: { footerSize: number }) => {
        footerSizeRef.current = metrics.footerSize;
        setFooterSize(metrics.footerSize);
      },
      []
    );
    const anchorTarget = useConversationAnchorTarget({
      anchor,
      anchorIndex,
      anchorToEnd,
      contentInsets,
      didTimeoutWaitingForAnchor,
      listRef,
      footerSize,
      itemCount: postsWithNeighbors.length,
      itemsRef: postsWithNeighborsRef,
      ownScroll,
    });
    const {
      didFinishInitialScroll,
      hasUserScrolled,
      markUserScrolled,
      finishUserNavigation,
      handleScrollFailure,
      scheduleInitialScroll,
    } = useInitialConversationScroll({
      owner,
      captureIntent,
      anchorTarget,
      isInitialAnchorReady,
      isLoading,
      itemCount: postsWithNeighbors.length,
      isFocused,
      onInitialScrollCompleted,
      onInitialScrollRecoveryChange,
    });
    const nativeReading = useNativeReadScope({
      scope: channel.id,
      items: postsWithNeighbors,
      owner: ownership,
      isFocused,
      isReady: isInitialAnchorReady && didFinishInitialScroll,
      isFollowing,
      diagnosticTimingSession: diagnostics?.nativeReadTimingSession,
    });
    const { initialScrollIndex } = anchorTarget;
    React.useEffect(() => {
      diagnostics?.event('entry-state', {
        ready: isInitialAnchorReady && didFinishInitialScroll,
        count: postsWithNeighbors.length,
      });
    }, [
      diagnostics,
      didFinishInitialScroll,
      isInitialAnchorReady,
      postsWithNeighbors.length,
    ]);
    React.useLayoutEffect(() => {
      postsWithNeighborsRef.current = postsWithNeighbors;
    }, [postsWithNeighbors]);
    // iOS follows the native end inside the owned mount transaction. Android
    // retains its existing layout callback; keyboard/composer inset animation
    // stays on KeyboardChatScrollView's UI-thread path.
    const settleFollowingConversationAtEnd = React.useCallback(() => {
      if (!canIssueCommand() || !isFollowing || owner.getMode() !== 'follow') {
        return;
      }
      // Bypass LegendList's deferred imperative commit for passive correction.
      // This uses the actual native content size, including footer and insets.
      const scrollView = listRef.current?.getNativeScrollRef() as
        | ScrollView
        | undefined;
      scrollView?.scrollToEnd({ animated: false });
    }, [owner, canIssueCommand, isFollowing]);
    const { onScroll: handleScroll, isAtBottom: isWithinBottomThreshold } =
      useScrollDirectionTracker({
        atBottomThreshold: onScrolledToBottomThreshold,
        bottomAtEnd: true,
      });
    const hasScrollDiagnostics = Boolean(diagnostics?.nativeScroll);
    const reportDiagnosticScroll = React.useCallback(
      (event: NativeScrollEvent) => diagnostics?.nativeScroll?.(event),
      [diagnostics]
    );
    const diagnosticScrollHandler = useAnimatedScrollHandler(
      (event) => {
        if (hasScrollDiagnostics) runOnJS(reportDiagnosticScroll)(event);
      },
      [hasScrollDiagnostics, reportDiagnosticScroll]
    );
    // Reanimated handlers are processed event objects on native. Compose them
    // on the UI thread instead of calling the production handler from JS.
    const composedScrollHandler = useComposedEventHandler([
      handleScroll,
      diagnosticScrollHandler,
    ]);
    // LegendList recalculates this when scrolling, content, or row measurements
    // change. React Native onScroll can retain an intermediate value while the
    // initial anchor settles, briefly showing the scroll-to-bottom control.
    const isNearEnd = useLegendListIsNearEnd(listRef);
    const conversationScrollEndAnchor = useConversationScrollEndAnchor();
    const capturedEndIntent = React.useRef<(() => boolean) | null>(null);
    const endAnchorHandler = React.useMemo(
      () => ({
        capture: () => {
          capturedEndIntent.current =
            canIssueCommand() && owner.getMode() === 'follow' && !hasNewerPosts
              ? captureIntent()
              : null;
        },
        restore: () => {
          const isCurrent = capturedEndIntent.current;
          capturedEndIntent.current = null;
          if (isCurrent)
            runOwnedNativeScroll(isCurrent, () =>
              listRef.current?.scrollToEnd({ animated: false })
            );
        },
      }),
      [
        owner,
        hasNewerPosts,
        canIssueCommand,
        captureIntent,
        runOwnedNativeScroll,
      ]
    );
    React.useLayoutEffect(() => {
      if (isFocused) {
        owner.activate();
      } else {
        // Covering a retained route retires its old target and follow intent.
        // Keep the measured viewport and reveal bookkeeping for the return.
        markUserScrolled(true, true);
        capturedEndIntent.current = null;
        owner.suspend();
      }
    }, [isFocused, owner, markUserScrolled]);
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
      postsWithNeighbors.length === 0 || isFollowing
        ? false
        : collectionLayout.shouldMaintainVisibleContentPosition && !isFollowing
          ? true
          : undefined;
    usePostListBottomCallbacks(isAtBottom, {
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });

    const beginUserDrag = React.useCallback(() => {
      if (!canIssueCommand()) return;
      owner.beginGesture();
      markUserScrolled(true);
      onScrollIntentChanged?.();
      diagnostics?.event('drag-begin');
    }, [
      owner,
      canIssueCommand,
      markUserScrolled,
      diagnostics,
      onScrollIntentChanged,
    ]);
    const settleUserGesture = React.useCallback(
      (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (!canIssueCommand()) return;
        const { contentOffset, contentSize, layoutMeasurement, contentInset } =
          event.nativeEvent;
        const end = Math.max(
          0,
          contentSize.height -
            layoutMeasurement.height +
            (contentInset?.bottom ?? 0)
        );
        owner.settleGesture(end - contentOffset.y, hasNewerPosts);
      },
      [owner, hasNewerPosts, canIssueCommand]
    );
    const publicMethodsRef = React.useRef<PostListMethods | null>(null);
    const publicMethods = React.useMemo(
      (): PostListMethods => ({
        captureScrollIntent: captureIntent,
        scrollToStart: (opts) => {
          if (!canIssueCommand()) return;
          owner.navigate('read');
          const isCurrent = captureIntent();
          if (!isCurrent()) return;
          markUserScrolled();
          onScrollIntentChanged?.();
          runOwnedNativeScroll(
            isCurrent,
            () =>
              listRef.current?.scrollToOffset({
                offset: 0,
                animated: opts.animated,
              }),
            requestAnimationFrame,
            finishUserNavigation,
            (error) =>
              handleScrollFailure(error, () =>
                publicMethodsRef.current?.scrollToStart(opts)
              )
          );
        },
        scrollToEnd: (opts) => {
          if (!canIssueCommand()) return;
          owner.navigate('follow');
          const isCurrent = captureIntent();
          if (!isCurrent()) return;
          markUserScrolled();
          onScrollIntentChanged?.();
          runOwnedNativeScroll(
            isCurrent,
            () => listRef.current?.scrollToEnd({ animated: opts.animated }),
            requestAnimationFrame,
            finishUserNavigation,
            (error) =>
              handleScrollFailure(error, () =>
                publicMethodsRef.current?.scrollToEnd(opts)
              )
          );
        },
        scrollToPost: ({ postId, animated, viewPosition = 0.5 }) => {
          if (!canIssueCommand()) return;
          owner.navigate('read');
          const isCurrent = captureIntent();
          if (!isCurrent()) return;
          markUserScrolled();
          onScrollIntentChanged?.();
          runOwnedNativeScroll(
            isCurrent,
            () => {
              const index = postsWithNeighborsRef.current.findIndex(
                ({ post }) => post.id === postId
              );
              if (index === -1) throw missingPostTarget(postId);
              const options = {
                animated,
                viewPosition,
                viewOffset: nativeAnchorViewOffset(
                  contentInsets.top,
                  contentInsets.bottom,
                  viewPosition,
                  Platform.OS === 'ios',
                  index === postsWithNeighborsRef.current.length - 1
                    ? footerSizeRef.current
                    : 0
                ),
              };
              return Platform.OS === 'ios'
                ? listRef.current?.scrollToItem({
                    ...options,
                    item: postsWithNeighborsRef.current[index],
                    ...(targetLayouts
                      ? {
                          getViewOffset: (current: {
                            item: PostWithNeighbors;
                            key: string;
                            index: number;
                            itemSize: number;
                          }) => {
                            const items = postsWithNeighborsRef.current;
                            if (
                              !isCurrent() ||
                              current.key !== postId ||
                              current.item !== items[current.index] ||
                              current.item.post.id !== postId
                            )
                              return undefined;
                            const geometry = targetLayouts.get(
                              postId,
                              current.itemSize,
                              PixelRatio.get()
                            );
                            if (!geometry) return undefined;
                            const insets = currentTargetInsets.current;
                            return (
                              nativeAnchorViewOffset(
                                insets.top,
                                insets.bottom,
                                viewPosition,
                                true,
                                current.index === items.length - 1
                                  ? footerSizeRef.current
                                  : 0
                              ) +
                              viewPosition * geometry.cellSizeDelta +
                              viewPosition * geometry.trailing -
                              (1 - viewPosition) * geometry.leading
                            );
                          },
                        }
                      : {}),
                  })
                : listRef.current?.scrollToIndex({ ...options, index });
            },
            requestAnimationFrame,
            finishUserNavigation,
            (error) =>
              handleScrollFailure(error, () =>
                publicMethodsRef.current?.scrollToPost({
                  postId,
                  animated,
                  viewPosition,
                })
              )
          );
        },
      }),
      [
        owner,
        captureIntent,
        canIssueCommand,
        markUserScrolled,
        finishUserNavigation,
        handleScrollFailure,
        runOwnedNativeScroll,
        targetLayouts,
        onScrollIntentChanged,
        contentInsets.top,
        contentInsets.bottom,
      ]
    );

    React.useLayoutEffect(() => {
      publicMethodsRef.current = publicMethods;
    }, [publicMethods]);
    React.useImperativeHandle(forwardedRef, () => publicMethods, [
      publicMethods,
    ]);
    const attachDiagnosticMethods = diagnostics?.attachMethods;
    React.useEffect(
      () => attachDiagnosticMethods?.(publicMethods),
      [attachDiagnosticMethods, publicMethods]
    );

    return (
      <NativeReadListContext.Provider value={nativeReading.context}>
        <KeyboardAwareLegendList<PostWithNeighbors>
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
          // The library's queued RAF checks proximity but not the current visit
          // or maintain flag. The native FOLLOW lease owns iOS passive following;
          // Android retains the layout callbacks above.
          maintainScrollAtEnd={false}
          maintainVisibleContentPosition={maintainVisibleContentPosition}
          nativeReadPointCorrection={nativeReading.routesReadCorrection}
          nativeReadPointIntent={nativeReading.intent}
          ListEmptyComponent={renderEmptyComponent}
          ListHeaderComponent={
            nativeReading.context ? (
              <>
                <NativeReadScopeContainer
                  descriptor={nativeReading.descriptor}
                  pointerEvents="none"
                  accessible={false}
                  style={{ width: 0, height: 0 }}
                />
                {listHeaderComponent}
              </>
            ) : (
              listHeaderComponent
            )
          }
          ListFooterComponent={listBottomComponent}
          contentContainerStyle={contentContainerStyle}
          {...conversationKeyboardListProps}
          // Preserve older messages while browsing history, but keep the latest
          // message anchored as the keyboard or composer grows at the end.
          keyboardLiftBehavior={isFollowing ? 'always' : 'never'}
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
          onMetricsChange={reportMetrics}
          onLoad={scheduleInitialScroll}
          onLayout={
            Platform.OS === 'ios' ? undefined : settleFollowingConversationAtEnd
          }
          onContentSizeChange={
            Platform.OS === 'ios' ? undefined : settleFollowingConversationAtEnd
          }
          onScroll={hasScrollDiagnostics ? composedScrollHandler : handleScroll}
          onScrollBeginDrag={beginUserDrag}
          onScrollEndDrag={(event) => {
            settleUserGesture(event);
            diagnostics?.event('drag-end');
          }}
          onMomentumScrollBegin={
            diagnostics ? () => diagnostics.event('momentum-begin') : undefined
          }
          onMomentumScrollEnd={(event) => {
            settleUserGesture(event);
            diagnostics?.event('momentum-end');
          }}
          onStartReached={onStartReached}
          onStartReachedThreshold={onStartReachedThreshold}
          onEndReached={onEndReached}
          onEndReachedThreshold={onEndReachedThreshold}
        />
      </NativeReadListContext.Provider>
    );
  }
);

ConversationPostListAttempt.displayName = 'ConversationPostListAttempt';
