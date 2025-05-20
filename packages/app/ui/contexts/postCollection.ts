import { JSONValue } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { createContext, useContext } from 'react';

import { MinimalRenderItemType, RenderItemType } from './componentsKits';

export interface PostCollectionContextValue {
  channel: db.Channel;
  collectionConfiguration?: Record<string, JSONValue>;
  editingPost?: db.Post;
  goToImageViewer: (post: db.Post, imageUri?: string) => void;
  goToPost: (post: db.Post) => void;
  hasNewerPosts?: boolean;
  hasOlderPosts?: boolean;
  headerMode: 'default' | 'next';
  initialChannelUnread?: db.ChannelUnread | null;
  isLoadingPosts: boolean;
  loadPostsError?: Error | null;
  onPressDelete: (post: db.Post) => void;
  onPressRetryLoad: () => void;
  onPressRetrySend: (post: db.Post) => Promise<void>;
  onScrollEndReached?: () => void;
  onScrollStartReached?: () => void;
  posts?: db.Post[];
  scrollToBottom?: () => void;
  selectedPostId?: string | null;
  setEditingPost?: (post: db.Post | undefined) => void;

  /**
   * Perfectly fine to use - you'll just need to pass more props than `PostView`.
   */
  LegacyPostView: RenderItemType;

  PostView: MinimalRenderItemType;
}

export const PostCollectionContext =
  createContext<PostCollectionContextValue | null>(null);

export function usePostCollectionContext() {
  const ctx = useContext(PostCollectionContext);
  if (ctx == null) {
    throw new Error('Missing PostCollectionContext');
  }
  return ctx;
}
