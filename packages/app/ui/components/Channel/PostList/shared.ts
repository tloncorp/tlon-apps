import type { PostCollectionLayoutType } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import type { ScrollAnchor } from '../Scroller';

export interface PostWithNeighbors {
  post: db.Post;
  newer: db.Post | null;
  older: db.Post | null;
}

export interface PostListMethods {
  scrollToStart: (opts: { animated?: boolean }) => void;
  scrollToIndex: (opts: { index: number; animated?: boolean }) => void;
}

export type PostListComponent = React.ForwardRefExoticComponent<{
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
  onInitialScrollCompleted?: () => void;
  /**
   * Called once each time the list is scrolled to the start. This is different
   * from `onStartReached` which prevents itself from firing until the scroll's
   * content height has changed.
   */
  onScrolledToBottom?: () => void;
  onScrolledAwayFromBottom?: () => void;
  onStartReached?: () => void;
  postsWithNeighbors: PostWithNeighbors[];
  ref: React.Ref<PostListMethods>;
  renderEmptyComponent?: () => JSX.Element;
  renderItem: (opts: {
    item: PostWithNeighbors;
    index: number;
  }) => React.ReactNode;
  scrollEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}>;
