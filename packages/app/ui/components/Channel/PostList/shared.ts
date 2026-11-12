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

/**
 * The host assigns a new id when it confirms an optimistic post, but keeps the
 * client's `sentAt`, so keying rows by it keeps a row mounted and measured
 * across confirmation.
 */
export function getPostListKey({ post }: PostWithNeighbors) {
  return `${post.authorId}:${post.sentAt}`;
}

const TEXT_LENGTH_STEPS = [60, 180, 400, 900];

/**
 * A row's item type for the list, grouping rows of about the same height.
 *
 * The list sizes a row it has not measured from the average of measured rows
 * of the same type. With one type for every message, a page of short replies
 * arriving under a few long messages was laid out at the long messages'
 * height, then shrank by thousands of points as it was measured, and the
 * corrections for that reached the scroll view late enough to drop the
 * message the reader was looking at. Grouping by what most changes a row's
 * height (media, references, text length) keeps that first guess close.
 */
export function getPostRowType({ post }: PostWithNeighbors) {
  // The list asks for types on every layout pass.
  let type = rowTypes.get(post);
  if (type === undefined) {
    type = computePostRowType(post);
    rowTypes.set(post, type);
  }
  return type;
}

const rowTypes = new WeakMap<db.Post, string>();

// Only the post itself decides its type, never its neighbours: a row whose
// type changed when the post above it arrived would be moved to another
// container and remounted on screen.
function computePostRowType(post: db.Post) {
  if (post.isDeleted) {
    return `${post.type}:deleted`;
  }
  const length = post.textContent?.length ?? 0;
  const lengthStep = TEXT_LENGTH_STEPS.findIndex((step) => length <= step);
  return [
    post.type,
    lengthStep === -1 ? TEXT_LENGTH_STEPS.length : lengthStep,
    post.hasImage ? 'image' : '',
    post.hasAppReference || post.hasChannelReference || post.hasGroupReference
      ? 'ref'
      : '',
    post.hasLink ? 'link' : '',
    post.blob ? 'blob' : '',
    (post.replyCount ?? 0) > 0 ? 'replies' : '',
  ].join(':');
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

/**
 * How a data change reshapes the window of loaded posts. Posts are in visual
 * order, oldest first.
 *
 * - `changesTop`: the oldest post is different, because older posts arrived
 *   above or posts were dropped from the top (a cached page replaced by a
 *   fresh one).
 * - `changesEnd`: the newest post is different.
 */
export function describeWindowChange(
  before: readonly PostWithNeighbors[],
  after: readonly PostWithNeighbors[]
) {
  if (before.length === 0 || after.length === 0) {
    return { changesTop: false, changesEnd: false };
  }
  return {
    changesTop: after[0]?.post.id !== before[0]?.post.id,
    changesEnd:
      after[after.length - 1]?.post.id !== before[before.length - 1]?.post.id,
  };
}

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
