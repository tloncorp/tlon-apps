import { isGroupChannelId } from '@tloncorp/api';

type RefreshablePost = {
  id: string;
  syncedAt?: number | null;
};

type RefreshPosts = (
  options: {
    channelId: string;
    startCursor: string;
    endCursor: string;
    afterTime: Date;
  },
  context: { priority: 4 }
) => Promise<unknown>;

export function supportsChangedPostsRefresh(channelId: string): boolean {
  // %channels exposes a cursor-bounded changed-posts endpoint for group
  // channel nests. %chat instead refreshes DMs and clubs through its global
  // changes-since feed, which is consumed by the normal sync path.
  return isGroupChannelId(channelId);
}

export function refreshStaleChannelPosts({
  channelId,
  posts,
  session,
  pendingPostIds,
  refreshPosts,
  onError,
}: {
  channelId: string;
  posts: RefreshablePost[] | null;
  session: { startTime?: number } | null;
  pendingPostIds: Set<string>;
  refreshPosts: RefreshPosts;
  onError: (error: unknown) => void;
}) {
  if (!supportsChangedPostsRefresh(channelId) || !session) {
    return;
  }

  const sessionStartTime = session.startTime ?? 0;
  const stalePosts =
    posts?.filter(
      (post) =>
        (post.syncedAt == null || post.syncedAt < sessionStartTime) &&
        !pendingPostIds.has(post.id)
    ) ?? [];

  const chunkSize = 50;
  for (let i = 0; i < stalePosts.length; i += chunkSize) {
    const chunk = stalePosts.slice(i, i + chunkSize);
    const pendingIds = chunk.map((post) => post.id);
    const startCursor = chunk[chunk.length - 1].id;
    const endCursor = chunk[0].id;

    pendingIds.forEach((id) => pendingPostIds.add(id));
    void refreshPosts(
      {
        channelId,
        startCursor,
        endCursor,
        afterTime: new Date(sessionStartTime),
      },
      { priority: 4 }
    ).catch((error) => {
      pendingIds.forEach((id) => pendingPostIds.delete(id));
      onError(error);
    });
  }
}
