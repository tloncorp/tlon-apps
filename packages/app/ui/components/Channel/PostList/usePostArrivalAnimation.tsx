import * as React from 'react';
import Animated, { Easing, FadeIn } from 'react-native-reanimated';

import { getAppendedPostIds } from './postArrivals';
import type { PostListComponentProps, PostWithNeighbors } from './shared';

const messageFadeIn = FadeIn.duration(220).easing(Easing.out(Easing.quad));

function PostArrival({
  postId,
  animate,
  displayedPostIds,
  children,
}: React.PropsWithChildren<{
  postId: string;
  animate: boolean;
  displayedPostIds: Set<string>;
}>) {
  const [shouldAnimate] = React.useState(
    () => animate && !displayedPostIds.has(postId)
  );
  React.useLayoutEffect(() => {
    // Virtualization may mount this post again when returning from history.
    displayedPostIds.add(postId);
  }, [displayedPostIds, postId]);

  return (
    <Animated.View entering={shouldAnimate ? messageFadeIn : undefined}>
      {children}
    </Animated.View>
  );
}

export function usePostArrivalAnimation({
  posts,
  renderItem,
  enabled,
}: {
  posts: PostWithNeighbors[];
  renderItem: PostListComponentProps['renderItem'];
  enabled: boolean;
}): PostListComponentProps['renderItem'] {
  const [displayedPostIds] = React.useState(() => new Set<string>());
  const [previous, setPrevious] = React.useState({
    posts,
    enabled,
    arrivals: new Set<string>(),
  });
  // Classify the update before the new rows mount, so their first native
  // frame already has the entry animation. Initial pages stay immediate.
  if (previous.posts !== posts || previous.enabled !== enabled) {
    setPrevious({
      posts,
      enabled,
      arrivals:
        enabled && previous.enabled
          ? getAppendedPostIds(previous.posts, posts)
          : new Set<string>(),
    });
  }
  const { arrivals } = previous;

  return React.useCallback(
    (props) => (
      <PostArrival
        key={props.item.post.id}
        postId={props.item.post.id}
        animate={arrivals.has(props.item.post.id)}
        displayedPostIds={displayedPostIds}
      >
        {renderItem(props)}
      </PostArrival>
    ),
    [arrivals, displayedPostIds, renderItem]
  );
}
