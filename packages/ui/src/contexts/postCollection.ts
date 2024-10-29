import * as db from '@tloncorp/shared/db';
import { createContext, useContext } from 'react';

import { MinimalRenderItemType, RenderItemType } from './componentsKits';

export interface PostCollectionContextValue {
  channel: db.Channel;
  editingPost?: db.Post;
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToPost: (post: db.Post) => void;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
  headerMode: 'default' | 'next';
  initialChannelUnread?: db.ChannelUnread | null;
  onPressDelete: (post: db.Post) => void;
  onPressRetry: (post: db.Post) => void;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  posts?: db.Post[];
  selectedPostId?: string | null;
  setEditingPost?: (post: db.Post | undefined) => void;

  /**
   * perfectly fine to use - just has more props than it needs
   */
  LegacyPostView: RenderItemType;

  PostView: MinimalRenderItemType;
}

export const PostCollectionContext =
  createContext<PostCollectionContextValue | null>(null);

export function usePostCollectionContext() {
  return useContext(PostCollectionContext);
}

export function usePostCollectionContextUnsafelyUnwrapped() {
  return useContext(PostCollectionContext)!;
}
