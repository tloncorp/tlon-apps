import * as React from 'react';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useConversationScrollViewNativeID,
  useScrollDirectionTracker,
} from '../../../contexts/scroll';
import { createNativeScrollOwnership } from './nativeScrollOwnership';
import { getPostListScopeKey } from './postListInitialization';
import { useAnchorScrollLock } from '../useAnchorScrollLock';
import {
  PostListComponent,
  PostListMethods,
  PostWithNeighbors,
  usePostListBottomCallbacks,
} from './shared';

function getPostId({ post }: PostWithNeighbors) {
  return post.id;
}

export const PostList: PostListComponent = React.forwardRef(
  (
    {
      postsWithNeighbors,
      channel,
      onScrollIntentChanged,
      isFocused = true,
      scrollVisit,
      scrollEnabled = true,
      numColumns,
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
      onInitialScrollCompleted,
      onScrolledToBottom,
      onScrolledToBottomThreshold = 1,
      onScrolledAwayFromBottom,
      listHeaderComponent,
      listBottomComponent,
    },
    forwardedRef
  ) => {
    const listRef =
      React.useRef<React.ElementRef<typeof Animated.FlatList>>(null);
    const scopeKey = getPostListScopeKey(channel.id, anchor);
    const owner = React.useMemo(
      () => createNativeScrollOwnership('read'),
      [scopeKey]
    );
    React.useLayoutEffect(() => {
      owner.activate();
      return () => owner.dispose();
    }, [owner]);
    const captureIntent = React.useCallback(() => {
      const intent = owner.capture();
      const visit = scrollVisit?.capture();
      return () => intent() && (visit?.() ?? true);
    }, [owner, scrollVisit]);
    const canIssueCommand = React.useCallback(
      () =>
        isFocused && (scrollVisit?.isCurrent() ?? true) && owner.capture()(),
      [isFocused, scrollVisit, owner]
    );
    const scrollViewNativeID = useConversationScrollViewNativeID();
    const selectedAnchor = anchor?.type === 'selected' ? anchor : null;
    const insets = useSafeAreaInsets();
    const scrollIndicatorInsets = React.useMemo(() => {
      return {
        top: 0,
        bottom: insets.bottom,
      };
    }, [insets.bottom]);

    const {
      readyToDisplayPosts,
      cancelPendingAnchorScroll,
      // setNeedsScrollToAnchor,
      // setDidAnchorSearchTimeout,
      scrollerItemProps: anchorScrollLockScrollerItemProps,
      flatlistProps: anchorScrollLockFlatlistProps,
    } = useAnchorScrollLock({
      posts: postsWithNeighbors.map((x) => x.post),
      anchor: selectedAnchor,
      flatListRef: listRef,
      columnsCount: numColumns,
    });

    React.useLayoutEffect(() => {
      if (isFocused) {
        owner.activate();
      } else {
        owner.suspend();
        cancelPendingAnchorScroll();
      }
    }, [owner, isFocused, cancelPendingAnchorScroll]);

    React.useEffect(() => {
      if (readyToDisplayPosts) {
        onInitialScrollCompleted?.();
      }
    }, [readyToDisplayPosts, onInitialScrollCompleted]);

    const { onScroll: handleScroll, isAtBottom } = useScrollDirectionTracker({
      atBottomThreshold: onScrolledToBottomThreshold,
    });
    usePostListBottomCallbacks(isAtBottom, {
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });

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
        captureScrollIntent: captureIntent,
        scrollToStart: (opts) => {
          if (!canIssueCommand()) return;
          owner.navigate('read');
          const isCurrent = captureIntent();
          if (!isCurrent()) return;
          cancelPendingAnchorScroll();
          onScrollIntentChanged?.();
          if (!isCurrent()) return;
          if (listRef.current) {
            listRef.current.scrollToOffset({
              offset: 0,
              animated: opts.animated,
            });
          }
        },
        scrollToEnd: (opts) => {
          if (!canIssueCommand()) return;
          owner.navigate('follow');
          const isCurrent = captureIntent();
          if (!isCurrent()) return;
          cancelPendingAnchorScroll();
          onScrollIntentChanged?.();
          if (!isCurrent()) return;
          if (listRef.current) {
            listRef.current.scrollToEnd({ animated: opts.animated });
          }
        },
        scrollToPost: ({ postId, animated, viewPosition }) => {
          if (!canIssueCommand()) return;
          owner.navigate('read');
          const isCurrent = captureIntent();
          if (!isCurrent()) return;
          cancelPendingAnchorScroll();
          onScrollIntentChanged?.();
          if (!isCurrent()) return;
          const rawIndex = postsWithNeighbors.findIndex(
            ({ post }) => post.id === postId
          );
          if (listRef.current && rawIndex !== -1) {
            listRef.current.scrollToIndex({
              index:
                numColumns > 1 ? Math.floor(rawIndex / numColumns) : rawIndex,
              animated,
              viewPosition,
            });
          }
        },
      })
    );

    const listStyle = useMemo(() => {
      return [style, readyToDisplayPosts ? null : { opacity: 0 }];
    }, [readyToDisplayPosts, style]);

    return (
      <Animated.FlatList<PostWithNeighbors>
        ref={listRef}
        testID={scrollViewNativeID}
        data={postsWithNeighbors}
        scrollEnabled={scrollEnabled}
        renderItem={renderItemWithExtraProps}
        ListEmptyComponent={renderEmptyComponent}
        keyExtractor={getPostId}
        keyboardDismissMode="on-drag"
        // Conversation composers float above these fallback notebook/gallery
        // lists, so iOS must add the keyboard to the scrollable inset too.
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        contentContainerStyle={contentContainerStyle}
        columnWrapperStyle={
          // FlatList raises an error if `columnWrapperStyle` is provided
          // with numColumns=1, even if the style is empty
          Object.keys(columnWrapperStyle || {}).length === 0
            ? undefined
            : columnWrapperStyle
        }
        ListFooterComponent={listBottomComponent}
        ListHeaderComponent={listHeaderComponent}
        maxToRenderPerBatch={15}
        windowSize={11}
        numColumns={numColumns}
        style={listStyle}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        onStartReached={onStartReached}
        onStartReachedThreshold={onStartReachedThreshold}
        scrollIndicatorInsets={scrollIndicatorInsets}
        automaticallyAdjustsScrollIndicatorInsets={false}
        onScroll={handleScroll}
        {...anchorScrollLockFlatlistProps}
        onScrollBeginDrag={() => {
          if (!canIssueCommand()) return;
          owner.beginGesture();
          cancelPendingAnchorScroll();
          onScrollIntentChanged?.();
        }}
      />
    );
  }
);
PostList.displayName = 'PostListFlatList';
