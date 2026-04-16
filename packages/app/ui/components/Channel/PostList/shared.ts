import type { PostCollectionLayoutType } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import type { ScrollAnchor } from '../scrollerTypes';

export interface PostWithNeighbors {
  post: db.Post;
  newer: db.Post | null;
  older: db.Post | null;
}

export interface PostListMethods {
  scrollToStart: (opts: { animated?: boolean }) => void;
  scrollToEnd: (opts: { animated?: boolean }) => void;
  scrollToIndex: (opts: {
    index: number;
    animated?: boolean;
    viewPosition?: number;
  }) => void;
}

export type PostListComponentProps = {
  anchor: ScrollAnchor | null | undefined;
  channel: db.Channel;
  collectionLayoutType: PostCollectionLayoutType;
  columnWrapperStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  hasNewerPosts?: boolean;
  inverted?: boolean;
  // This should take precedence over the `collectionLayoutType`'s intrinsic column count
  numColumns: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onInitialScrollCompleted?: () => void;
  /**
   * Called once each time the list is scrolled to the start. This is different
   * from `onStartReached` which prevents itself from firing until the scroll's
   * content height has changed.
   */
  onScrolledToBottom?: () => void;
  /**
   * Ratio of viewport height to distance from bottom for triggering
   * `onScrolledToBottomThreshold` and `onScrolledAwayFromBottomThreshold`.
   * On native, viewport height is the screen height; on web, it is the scroll viewport.
   * @default 0
   */
  onScrolledToBottomThreshold?: number;
  onScrolledAwayFromBottom?: () => void;
  onStartReached?: () => void;
  onStartReachedThreshold?: number;
  postsWithNeighbors: PostWithNeighbors[];
  renderEmptyComponent?: () => JSX.Element;
  renderItem: (opts: {
    item: PostWithNeighbors;
    index: number;
  }) => React.ReactElement | null;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Content to display at the visual top of the list (above all items).
   * Used to render gallery/notebook headers inside the PostList, avoiding
   * nested FlatLists which break on Android.
   *
   * Mapped to ListFooterComponent when inverted, ListHeaderComponent otherwise.
   */
  listHeaderComponent?: React.ReactElement;
};

export type PostListComponent = ReturnType<
  typeof React.forwardRef<PostListMethods, PostListComponentProps>
>;
