export function shouldFallbackFromUnreadCursor({
  unreadCursor,
  selectedPostId,
  clearedCursor,
  queryFailureCount,
}: {
  unreadCursor?: string | false | null;
  selectedPostId?: string | null;
  clearedCursor: boolean;
  queryFailureCount: number;
}) {
  return Boolean(
    unreadCursor && !selectedPostId && !clearedCursor && queryFailureCount > 0
  );
}
