import type { PostCollectionLayoutType } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

import type { ConversationContentInsets } from '../../conversationInsets';
import type { ScrollAnchor } from '../scrollerTypes';

export interface PostWithNeighbors {
  post: db.Post;
  previous: db.Post | null;
  next: db.Post | null;
}

export interface PostListMethods {
  scrollToStart: (opts: { animated?: boolean }) => void;
  scrollToEnd: (opts: { animated?: boolean }) => void;
  scrollToPost: (opts: {
    postId: string;
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
  contentInsets?: ConversationContentInsets;
  hasNewerPosts?: boolean;
  isLoading?: boolean;
  /** Pins short content and new items to the visual end of the list. */
  anchorToEnd?: boolean;
  // This should take precedence over the `collectionLayoutType`'s intrinsic column count
  numColumns: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onInitialScrollPending?: () => void;
  onInitialScrollCompleted?: () => void;
  /**
   * Called once each time the list is scrolled to the visual bottom. This is
   * different from `onEndReached`, which prevents itself from firing until the scroll's
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
  renderEmptyComponent?: () => React.ReactElement;
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
   */
  listHeaderComponent?: React.ReactElement;
  /**
   * Content to display at the visual bottom of the list (below all items).
   */
  listBottomComponent?: React.ReactElement;
};

export type PostListComponent = ReturnType<
  typeof React.forwardRef<PostListMethods, PostListComponentProps>
>;

export function usesConversationPostList({
  collectionLayoutType,
}: Pick<PostListComponentProps, 'collectionLayoutType'>) {
  return collectionLayoutType === 'compact-list-bottom-to-top';
}

export function usePostListBottomCallbacks(
  isAtBottom: boolean,
  {
    onScrolledToBottom,
    onScrolledAwayFromBottom,
  }: Pick<
    PostListComponentProps,
    'onScrolledToBottom' | 'onScrolledAwayFromBottom'
  >
) {
  React.useEffect(() => {
    if (isAtBottom) {
      onScrolledToBottom?.();
    } else {
      onScrolledAwayFromBottom?.();
    }
  }, [isAtBottom, onScrolledAwayFromBottom, onScrolledToBottom]);
}
