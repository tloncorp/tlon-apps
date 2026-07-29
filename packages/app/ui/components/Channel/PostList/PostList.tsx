import * as React from 'react';

import { PostList as PostListFlatList } from './PostListFlatList';
import { PostList as PostListLegendList } from './PostListLegendList';
import type { PostListComponent } from './shared';

export const PostList: PostListComponent = React.forwardRef((props, ref) => {
  const usesLegendChatList = props.inverted && props.numColumns === 1;

  return usesLegendChatList ? (
    <PostListLegendList {...props} ref={ref} />
  ) : (
    <PostListFlatList {...props} ref={ref} />
  );
});

PostList.displayName = 'PostList';
