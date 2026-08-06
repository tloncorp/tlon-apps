import * as React from 'react';
import { useMemo } from 'react';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScrollDirectionTracker } from '../../../contexts/scroll';
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
        scrollToStart: (opts) => {
          if (listRef.current) {
            listRef.current.scrollToOffset({
              offset: 0,
              animated: opts.animated,
            });
          }
        },
        scrollToEnd: (opts) => {
          if (listRef.current) {
            listRef.current.scrollToEnd({ animated: opts.animated });
          }
        },
        scrollToPost: ({ postId, animated, viewPosition }) => {
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
        data={postsWithNeighbors}
        scrollEnabled={scrollEnabled}
        renderItem={renderItemWithExtraProps}
        ListEmptyComponent={renderEmptyComponent}
        keyExtractor={getPostId}
        keyboardDismissMode="on-drag"
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
      />
    );
  }
);
PostList.displayName = 'PostListFlatList';
