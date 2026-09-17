import * as React from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { EaseView, type TimingTransition } from 'react-native-ease';

import { getAppendedPostIds } from './postArrivals';
import type { PostListComponentProps, PostWithNeighbors } from './shared';

const messageFadeIn: TimingTransition = {
  type: 'timing',
  duration: 400,
  easing: 'easeInOut',
};

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
  // LegendList measures new rows before placing them in the scrolling content.
  // Keep the fade pending until the row has a real layout.
  const [hasLayout, setHasLayout] = React.useState(false);
  const handleLayout = React.useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      if (nativeEvent.layout.width > 0 && nativeEvent.layout.height > 0) {
        setHasLayout(true);
      }
    },
    []
  );
  React.useLayoutEffect(() => {
    // Virtualization may mount this post again when returning from history.
    displayedPostIds.add(postId);
  }, [displayedPostIds, postId]);

  return (
    <EaseView
      initialAnimate={shouldAnimate ? { opacity: 0 } : undefined}
      animate={{ opacity: shouldAnimate && !hasLayout ? 0 : 1 }}
      onLayout={shouldAnimate && !hasLayout ? handleLayout : undefined}
      transition={messageFadeIn}
    >
      {children}
    </EaseView>
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
