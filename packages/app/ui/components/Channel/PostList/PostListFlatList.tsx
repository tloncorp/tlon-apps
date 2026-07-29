import { layoutForType } from '@tloncorp/shared';
import * as React from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  conversationNavigationBarHeight,
  conversationScrollViewNativeID,
  supportsNativeScrollEdgeEffects,
} from '../../nativeScrollEdgeEffects';
import { useAnchorScrollLock } from '../useAnchorScrollLock';
import {
  HISTORY_WINDOW_INCREMENT,
  INITIAL_RECENT_WINDOW_SIZE,
  getExplicitChatListMountKey,
  getExplicitChatWindowStartIndex,
} from './explicitChatListInitialization';
import {
  PostListComponent,
  PostListMethods,
  PostWithNeighbors,
  getPostId,
  usePostListBottomTracking,
} from './shared';

export const PostList: PostListComponent = React.forwardRef(
  (
    {
      postsWithNeighbors,
      scrollEnabled = true,
      numColumns,
      inverted,
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
      hasNewerPosts,
      collectionLayoutType,
      onInitialScrollCompleted,
      onScrolledToBottom,
      onScrolledToBottomThreshold = 1,
      onScrolledAwayFromBottom,
      listHeaderComponent,
      listBottomComponent,
    },
    forwardedRef
  ) => {
    const collectionLayout = React.useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    // React Native implements `inverted` with a vertical transform. UIKit's
    // scroll-edge effect inherits that transform and expands across the whole
    // conversation. On iOS 26, keep the scroll view upright and reverse the
    // single-column chat data explicitly instead.
    const usesExplicitChatOrder = Boolean(
      supportsNativeScrollEdgeEffects && inverted && numColumns === 1
    );
    const orderedPosts = React.useMemo(
      () =>
        usesExplicitChatOrder
          ? [...postsWithNeighbors].reverse()
          : postsWithNeighbors,
      [postsWithNeighbors, usesExplicitChatOrder]
    );
    const explicitAnchorIndex = React.useMemo(() => {
      if (!usesExplicitChatOrder || !anchor?.postId) {
        return -1;
      }

      return orderedPosts.findIndex(({ post }) => post.id === anchor.postId);
    }, [anchor?.postId, orderedPosts, usesExplicitChatOrder]);
    const [additionalExplicitHistoryCount, setAdditionalExplicitHistoryCount] =
      React.useState(0);
    React.useEffect(() => {
      setAdditionalExplicitHistoryCount(0);
    }, [anchor?.postId, usesExplicitChatOrder]);
    const explicitWindowStartIndex = React.useMemo(
      () =>
        getExplicitChatWindowStartIndex({
          enabled: usesExplicitChatOrder,
          postCount: orderedPosts.length,
          anchorIndex: explicitAnchorIndex,
          additionalHistoryCount: additionalExplicitHistoryCount,
        }),
      [
        additionalExplicitHistoryCount,
        explicitAnchorIndex,
        orderedPosts.length,
        usesExplicitChatOrder,
      ]
    );
    const displayedPosts = React.useMemo(() => {
      if (!usesExplicitChatOrder || orderedPosts.length === 0) {
        return orderedPosts;
      }

      return orderedPosts.slice(explicitWindowStartIndex);
    }, [explicitWindowStartIndex, orderedPosts, usesExplicitChatOrder]);
    const displayedAnchorIndex = React.useMemo(() => {
      if (!usesExplicitChatOrder || !anchor?.postId) {
        return -1;
      }

      return displayedPosts.findIndex(({ post }) => post.id === anchor.postId);
    }, [anchor?.postId, displayedPosts, usesExplicitChatOrder]);
    const explicitInitialScrollIndex = React.useMemo(() => {
      if (!usesExplicitChatOrder || displayedPosts.length === 0) {
        return undefined;
      }

      if (displayedAnchorIndex !== -1) {
        return displayedAnchorIndex;
      }

      return displayedPosts.length - 1;
    }, [displayedAnchorIndex, displayedPosts.length, usesExplicitChatOrder]);
    const explicitListMountKey = getExplicitChatListMountKey({
      enabled: usesExplicitChatOrder,
      postCount: orderedPosts.length,
      anchorId: anchor?.postId,
      anchorIndex: explicitAnchorIndex,
    });
    const listRef =
      React.useRef<React.ElementRef<typeof Animated.FlatList>>(null);
    const insets = useSafeAreaInsets();
    const explicitUnreadAnchorViewOffset =
      usesExplicitChatOrder && anchor?.type === 'unread'
        ? insets.top + conversationNavigationBarHeight
        : 0;
    const scrollIndicatorInsets = React.useMemo(() => {
      return {
        top: 0,
        bottom: insets.bottom,
      };
    }, [insets.bottom]);

    const {
      readyToDisplayPosts,
      // setNeedsScrollToAnchor,
      // setDidAnchorSearchTimeout,
      scrollerItemProps: anchorScrollLockScrollerItemProps,
      flatlistProps: anchorScrollLockFlatlistProps,
    } = useAnchorScrollLock({
      posts: displayedPosts.map((x) => x.post),
      anchor,
      flatListRef: listRef,
      hasNewerPosts,
      shouldMaintainVisibleContentPosition:
        collectionLayout.shouldMaintainVisibleContentPosition,
      dataStartIsVisualBottom: !usesExplicitChatOrder,
      shouldMirrorViewPosition: usesExplicitChatOrder,
      shouldInitiateScrollWhenAnchorAppears: usesExplicitChatOrder,
      anchorViewOffset: explicitUnreadAnchorViewOffset,
      collectionLayoutType,
      columnsCount: numColumns,
    });
    const {
      onScrollBeginDrag: onAnchorScrollBeginDrag,
      ...remainingAnchorScrollLockFlatlistProps
    } = anchorScrollLockFlatlistProps;

    const { onScroll: handleScroll, isAtContentEnd } =
      usePostListBottomTracking({
        atBottomThreshold: onScrolledToBottomThreshold,
        bottomAtEnd: usesExplicitChatOrder,
        onScrolledToBottom,
        onScrolledAwayFromBottom,
      });
    const isAtContentEndRef = React.useRef(isAtContentEnd);
    isAtContentEndRef.current = isAtContentEnd;

    const renderItemWithExtraProps = React.useCallback<typeof renderItem>(
      ({ item, index }) =>
        renderItem({
          item: {
            ...item,
            ...anchorScrollLockScrollerItemProps,
          },
          index,
        }),
      [anchorScrollLockScrollerItemProps, renderItem]
    );

    React.useImperativeHandle(
      forwardedRef,
      (): PostListMethods => ({
        scrollToStart: (opts) => {
          if (listRef.current) {
            if (usesExplicitChatOrder) {
              listRef.current.scrollToEnd({ animated: opts.animated });
            } else {
              listRef.current.scrollToOffset({
                offset: 0,
                animated: opts.animated,
              });
            }
          }
        },
        scrollToEnd: (opts) => {
          if (listRef.current) {
            if (usesExplicitChatOrder) {
              listRef.current.scrollToOffset({
                offset: 0,
                animated: opts.animated,
              });
            } else {
              listRef.current.scrollToEnd({ animated: opts.animated });
            }
          }
        },
        scrollToIndex: ({ index, animated, viewPosition }) => {
          if (listRef.current) {
            const resolvedIndex = usesExplicitChatOrder
              ? orderedPosts.length - 1 - index - explicitWindowStartIndex
              : index;
            if (resolvedIndex < 0 || resolvedIndex >= displayedPosts.length) {
              return;
            }
            const resolvedViewPosition = usesExplicitChatOrder
              ? 1 - (viewPosition ?? 0)
              : viewPosition;
            listRef.current.scrollToIndex({
              index: resolvedIndex,
              animated,
              viewPosition: resolvedViewPosition,
            });
          }
        },
      })
    );

    const [hasPositionedExplicitList, setHasPositionedExplicitList] =
      React.useState(!usesExplicitChatOrder);
    const hasPositionedExplicitListRef = React.useRef(
      hasPositionedExplicitList
    );
    const initialPositionFrameRef = React.useRef<number | null>(null);
    const initialPositionTimerRef = React.useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
    const userInterruptedInitialPositionRef = React.useRef(false);
    const visualBottomPostId =
      orderedPosts[orderedPosts.length - 1]?.post.id ?? null;
    const previousVisualBottomPostIdRef = React.useRef(visualBottomPostId);
    const hasExplicitPosts = usesExplicitChatOrder && orderedPosts.length > 0;
    const canPositionExplicitList =
      !anchor?.postId || displayedAnchorIndex !== -1 || readyToDisplayPosts;

    const cancelScheduledExplicitPosition = React.useCallback(() => {
      if (initialPositionTimerRef.current !== null) {
        clearTimeout(initialPositionTimerRef.current);
        initialPositionTimerRef.current = null;
      }
      if (initialPositionFrameRef.current !== null) {
        cancelAnimationFrame(initialPositionFrameRef.current);
        initialPositionFrameRef.current = null;
      }
    }, []);

    const scrollToExplicitInitialPosition = React.useCallback(() => {
      if (!listRef.current || !canPositionExplicitList) {
        return;
      }

      if (anchor?.postId && displayedAnchorIndex !== -1) {
        listRef.current.scrollToIndex({
          index: displayedAnchorIndex,
          animated: false,
          viewPosition: anchor.type === 'unread' ? 0 : 0.5,
          viewOffset:
            anchor.type === 'unread' ? explicitUnreadAnchorViewOffset : 0,
        });
      } else {
        listRef.current.scrollToEnd({ animated: false });
      }
    }, [
      anchor?.postId,
      anchor?.type,
      canPositionExplicitList,
      displayedAnchorIndex,
      explicitUnreadAnchorViewOffset,
    ]);

    React.useLayoutEffect(() => {
      const previousVisualBottomPostId = previousVisualBottomPostIdRef.current;
      previousVisualBottomPostIdRef.current = visualBottomPostId;

      if (
        !usesExplicitChatOrder ||
        anchor?.postId ||
        previousVisualBottomPostId === visualBottomPostId ||
        !hasPositionedExplicitListRef.current ||
        !isAtContentEndRef.current
      ) {
        return;
      }

      const frame = requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
      return () => cancelAnimationFrame(frame);
    }, [anchor?.postId, usesExplicitChatOrder, visualBottomPostId]);

    const scheduleRevealExplicitList = React.useCallback(() => {
      if (
        hasPositionedExplicitListRef.current ||
        userInterruptedInitialPositionRef.current ||
        !canPositionExplicitList
      ) {
        return;
      }

      scrollToExplicitInitialPosition();
      if (initialPositionTimerRef.current !== null) {
        clearTimeout(initialPositionTimerRef.current);
      }
      initialPositionTimerRef.current = setTimeout(() => {
        initialPositionTimerRef.current = null;
        if (
          hasPositionedExplicitListRef.current ||
          userInterruptedInitialPositionRef.current
        ) {
          return;
        }

        scrollToExplicitInitialPosition();
        initialPositionFrameRef.current = requestAnimationFrame(() => {
          initialPositionFrameRef.current = null;
          if (
            hasPositionedExplicitListRef.current ||
            userInterruptedInitialPositionRef.current
          ) {
            return;
          }

          scrollToExplicitInitialPosition();
          hasPositionedExplicitListRef.current = true;
          setHasPositionedExplicitList(true);
        });
      }, 250);
    }, [canPositionExplicitList, scrollToExplicitInitialPosition]);

    const handleContentSizeChange = React.useCallback(
      (_width: number, _height: number) => {
        if (
          !usesExplicitChatOrder ||
          orderedPosts.length === 0 ||
          !listRef.current
        ) {
          return;
        }

        // Variable-height posts can report several content-size changes while
        // mounting. Reveal only after a quiet layout frame so an old position
        // is never shown immediately before a jump to its anchor or the bottom.
        if (!hasPositionedExplicitListRef.current) {
          scheduleRevealExplicitList();
          return;
        }

        if (
          !anchor?.postId &&
          !userInterruptedInitialPositionRef.current &&
          isAtContentEndRef.current
        ) {
          listRef.current.scrollToEnd({ animated: false });
        }
      },
      [
        anchor?.postId,
        orderedPosts.length,
        scheduleRevealExplicitList,
        usesExplicitChatOrder,
      ]
    );

    React.useEffect(() => {
      if (!hasExplicitPosts) {
        return;
      }

      cancelScheduledExplicitPosition();
      userInterruptedInitialPositionRef.current = false;
      hasPositionedExplicitListRef.current = false;
      setHasPositionedExplicitList(false);
    }, [
      cancelScheduledExplicitPosition,
      explicitListMountKey,
      hasExplicitPosts,
    ]);

    React.useEffect(() => {
      if (hasExplicitPosts) {
        scheduleRevealExplicitList();
      }
    }, [hasExplicitPosts, scheduleRevealExplicitList]);

    React.useEffect(() => {
      return cancelScheduledExplicitPosition;
    }, [cancelScheduledExplicitPosition]);

    const handleScrollBeginDrag = React.useCallback(() => {
      userInterruptedInitialPositionRef.current = true;
      cancelScheduledExplicitPosition();
      if (!hasPositionedExplicitListRef.current) {
        hasPositionedExplicitListRef.current = true;
        setHasPositionedExplicitList(true);
      }
      onAnchorScrollBeginDrag();
    }, [cancelScheduledExplicitPosition, onAnchorScrollBeginDrag]);

    const didCompleteInitialPosition =
      readyToDisplayPosts && hasPositionedExplicitList;
    const readyToDisplayList =
      (usesExplicitChatOrder && orderedPosts.length === 0) ||
      didCompleteInitialPosition;
    React.useEffect(() => {
      if (didCompleteInitialPosition) {
        onInitialScrollCompleted?.();
      }
    }, [didCompleteInitialPosition, onInitialScrollCompleted]);

    const listStyle = useMemo(() => {
      return [{ flex: 1 }, style, readyToDisplayList ? null : { opacity: 0 }];
    }, [readyToDisplayList, style]);

    // https://github.com/facebook/react-native/issues/21196
    // Disable `inverted` when list is empty to avoid RN rendering bugs.
    const effectiveInverted =
      (postsWithNeighbors?.length || 0) === 0 ? false : inverted;
    const nativeInverted = effectiveInverted && !usesExplicitChatOrder;
    const resolvedContentContainerStyle = usesExplicitChatOrder
      ? [
          { flexGrow: 1, justifyContent: 'flex-end' as const },
          contentContainerStyle,
        ]
      : contentContainerStyle;
    const hasHiddenExplicitHistory =
      usesExplicitChatOrder && explicitWindowStartIndex > 0;
    const handleExplicitStartReached = React.useCallback(() => {
      if (hasHiddenExplicitHistory) {
        setAdditionalExplicitHistoryCount(
          (count) => count + HISTORY_WINDOW_INCREMENT
        );
        return;
      }

      onEndReached?.();
    }, [hasHiddenExplicitHistory, onEndReached]);

    return (
      <Animated.FlatList<PostWithNeighbors>
        key={explicitListMountKey}
        ref={listRef}
        data={displayedPosts}
        initialScrollIndex={explicitInitialScrollIndex}
        testID={
          supportsNativeScrollEdgeEffects
            ? conversationScrollViewNativeID
            : undefined
        }
        scrollEnabled={scrollEnabled}
        renderItem={renderItemWithExtraProps}
        ListEmptyComponent={renderEmptyComponent}
        keyExtractor={getPostId}
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios'
            ? usesExplicitChatOrder
              ? 'never'
              : 'automatic'
            : undefined
        }
        contentContainerStyle={resolvedContentContainerStyle}
        columnWrapperStyle={
          // FlatList raises an error if `columnWrapperStyle` is provided
          // with numColumns=1, even if the style is empty
          Object.keys(columnWrapperStyle || {}).length === 0
            ? undefined
            : columnWrapperStyle
        }
        inverted={nativeInverted}
        ListFooterComponent={
          nativeInverted ? listHeaderComponent : listBottomComponent
        }
        ListHeaderComponent={
          nativeInverted ? listBottomComponent : listHeaderComponent
        }
        initialNumToRender={
          usesExplicitChatOrder ? INITIAL_RECENT_WINDOW_SIZE : undefined
        }
        maxToRenderPerBatch={15}
        windowSize={11}
        numColumns={numColumns}
        style={listStyle}
        onEndReached={usesExplicitChatOrder ? onStartReached : onEndReached}
        onEndReachedThreshold={
          usesExplicitChatOrder
            ? onStartReachedThreshold
            : onEndReachedThreshold
        }
        onStartReached={
          usesExplicitChatOrder ? handleExplicitStartReached : onStartReached
        }
        onStartReachedThreshold={
          usesExplicitChatOrder
            ? onEndReachedThreshold
            : onStartReachedThreshold
        }
        scrollIndicatorInsets={scrollIndicatorInsets}
        automaticallyAdjustsScrollIndicatorInsets={false}
        onScroll={handleScroll}
        onContentSizeChange={handleContentSizeChange}
        {...remainingAnchorScrollLockFlatlistProps}
        onScrollBeginDrag={handleScrollBeginDrag}
      />
    );
  }
);
PostList.displayName = 'PostListFlatList';
