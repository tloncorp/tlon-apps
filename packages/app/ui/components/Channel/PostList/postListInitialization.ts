export function isPostListAnchorReady({
  anchorId,
  anchorIndex,
  didTimeoutWaitingForAnchor = false,
}: {
  anchorId?: string;
  anchorIndex: number;
  didTimeoutWaitingForAnchor?: boolean;
}) {
  return !anchorId || anchorIndex !== -1 || didTimeoutWaitingForAnchor;
}

export function getPostListMountKey({
  postCount,
  anchorId,
  anchorIndex,
  didTimeoutWaitingForAnchor = false,
}: {
  postCount: number;
  anchorId?: string;
  anchorIndex: number;
  didTimeoutWaitingForAnchor?: boolean;
}) {
  if (anchorId) {
    const resolution = didTimeoutWaitingForAnchor
      ? 'fallback'
      : anchorIndex !== -1
        ? 'ready'
        : 'waiting';
    return `anchor:${anchorId}:${resolution}`;
  }

  return `latest:${postCount > 0 ? 'ready' : 'waiting'}`;
}
