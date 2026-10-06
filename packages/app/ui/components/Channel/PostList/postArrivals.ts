type PostIdentity = { post: { id: string } };

/** Only a contiguous addition after the previous tail is a live arrival. */
export function getAppendedPostIds(
  previous: readonly PostIdentity[],
  current: readonly PostIdentity[]
): Set<string> {
  const previousTail = previous.at(-1)?.post.id;
  const tailIndex = previousTail
    ? current.findIndex(({ post }) => post.id === previousTail)
    : -1;

  // A replaced window (search, unread anchor, etc.) is not a new message.
  if (previousTail && tailIndex === -1) {
    return new Set();
  }

  const previousIds = new Set(previous.map(({ post }) => post.id));
  return new Set(
    current
      .slice(tailIndex + 1)
      .filter(({ post }) => !previousIds.has(post.id))
      .map(({ post }) => post.id)
  );
}
