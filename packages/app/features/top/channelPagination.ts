export function shouldAutoLoadOlderPosts({
  isFetching,
  isError,
  hasNextPage,
  unreadDidInitialize,
  postCount,
  minimumPostCount,
  postsBeforeAnchor = null,
  minimumPostsBeforeAnchor = 0,
  oldestPageHasOnlyDeletedPosts,
}: {
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  unreadDidInitialize: boolean;
  postCount?: number;
  minimumPostCount: number;
  /** Loaded posts older than the one the channel opens on, if it opens on one. */
  postsBeforeAnchor?: number | null;
  minimumPostsBeforeAnchor?: number;
  oldestPageHasOnlyDeletedPosts: boolean;
}) {
  return (
    !isFetching &&
    !isError &&
    hasNextPage &&
    unreadDidInitialize &&
    (postCount == null ||
      postCount < minimumPostCount ||
      (postsBeforeAnchor !== null &&
        postsBeforeAnchor < minimumPostsBeforeAnchor) ||
      oldestPageHasOnlyDeletedPosts)
  );
}
