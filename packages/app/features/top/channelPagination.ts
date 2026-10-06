export function shouldAutoLoadOlderPosts({
  isFetching,
  isError,
  hasNextPage,
  unreadDidInitialize,
  postCount,
  minimumPostCount,
  oldestPageHasOnlyDeletedPosts,
}: {
  isFetching: boolean;
  isError: boolean;
  hasNextPage: boolean;
  unreadDidInitialize: boolean;
  postCount?: number;
  minimumPostCount: number;
  oldestPageHasOnlyDeletedPosts: boolean;
}) {
  return (
    !isFetching &&
    !isError &&
    hasNextPage &&
    unreadDidInitialize &&
    (postCount == null ||
      postCount < minimumPostCount ||
      oldestPageHasOnlyDeletedPosts)
  );
}
