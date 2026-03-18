import { layoutForType } from '@tloncorp/shared';
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
    },
    forwardedRef
  ) => {
    const collectionLayout = React.useMemo(
      () => layoutForType(collectionLayoutType),
      [collectionLayoutType]
    );
    const listRef =
      React.useRef<React.ElementRef<typeof Animated.FlatList>>(null);
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
      anchor,
      flatListRef: listRef,
      hasNewerPosts,
      shouldMaintainVisibleContentPosition:
        collectionLayout.shouldMaintainVisibleContentPosition,
      collectionLayoutType,
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
    React.useEffect(() => {
      if (isAtBottom) {
        onScrolledToBottom?.();
      } else {
        onScrolledAwayFromBottom?.();
      }
    }, [onScrolledToBottom, onScrolledAwayFromBottom, isAtBottom]);

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
        scrollToIndex: ({ index, animated, viewPosition }) => {
          if (listRef.current) {
            listRef.current.scrollToIndex({ index, animated, viewPosition });
          }
        },
      })
    );

    const listStyle = useMemo(() => {
      return [style, readyToDisplayPosts ? null : { opacity: 0 }];
    }, [readyToDisplayPosts, style]);

    // https://github.com/facebook/react-native/issues/21196
    // Disable `inverted` when list is empty to avoid RN rendering bugs.
    const effectiveInverted =
      (postsWithNeighbors?.length || 0) === 0 ? false : inverted;

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
        inverted={effectiveInverted}
        ListFooterComponent={
          effectiveInverted ? listHeaderComponent : undefined
        }
        ListHeaderComponent={
          effectiveInverted ? undefined : listHeaderComponent
        }
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
