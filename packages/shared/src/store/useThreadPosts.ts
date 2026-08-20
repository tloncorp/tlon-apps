import { useQuery } from '@tanstack/react-query';
import { isInteractiveActionOnlyBlob } from '@tloncorp/api';
import { useEffect } from 'react';

import * as db from '../db';
import { syncThreadPosts } from './sync';
import { useKeyFromQueryDeps } from './useKeyFromQueryDeps';

/**
 * Drop replies that are nothing but a recorded tap on an interactive card.
 *
 * A tap is a reply because that is how it gets a host-assigned id and a
 * host-verified author (see docs/tlon-apps/interactive-surfaces.md), but it is
 * machinery and not a message. The predicate requires the blob to be exactly
 * one `interactive-action` entry, so a reply that also carries real user
 * content stays visible.
 */
function withoutInteractiveActions(posts: db.Post[]): db.Post[] {
  return posts.filter((post) => !isInteractiveActionOnlyBlob(post.blob));
}

export const useThreadPosts = ({
  postId,
  channelId,
  authorId,
}: {
  postId: string;
  authorId: string;
  channelId: string;
}) => {
  useEffect(() => {
    // TODO: Check if necessary, based on unreads or reply count
    syncThreadPosts({
      postId,
      authorId,
      channelId,
    });
  }, [authorId, channelId, postId]);

  return useQuery({
    queryKey: [
      ['thread', postId, authorId],
      useKeyFromQueryDeps(db.getThreadPosts),
    ],
    queryFn: async () =>
      withoutInteractiveActions(await db.getThreadPosts({ parentId: postId })),
  });
};
