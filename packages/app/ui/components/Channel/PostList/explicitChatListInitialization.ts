export const INITIAL_RECENT_WINDOW_SIZE = 15;
export const INITIAL_ANCHOR_HISTORY_SIZE = 5;
export const HISTORY_WINDOW_INCREMENT = 15;

export function isExplicitChatAnchorReady({
  anchorId,
  anchorIndex,
}: {
  anchorId?: string;
  anchorIndex: number;
}) {
  return !anchorId || anchorIndex !== -1;
}

export function getExplicitChatWindowStartIndex({
  enabled,
  postCount,
  anchorIndex,
  additionalHistoryCount,
}: {
  enabled: boolean;
  postCount: number;
  anchorIndex: number;
  additionalHistoryCount: number;
}) {
  if (!enabled || postCount === 0) {
    return 0;
  }

  if (anchorIndex !== -1) {
    return Math.max(
      0,
      anchorIndex - INITIAL_ANCHOR_HISTORY_SIZE - additionalHistoryCount
    );
  }

  return Math.max(
    0,
    postCount - INITIAL_RECENT_WINDOW_SIZE - additionalHistoryCount
  );
}

export function getExplicitChatListMountKey({
  enabled,
  postCount,
  anchorId,
  anchorIndex,
}: {
  enabled: boolean;
  postCount: number;
  anchorId?: string;
  anchorIndex: number;
}) {
  if (!enabled) {
    return undefined;
  }

  if (anchorId) {
    return `anchor:${anchorId}:${anchorIndex !== -1 ? 'ready' : 'waiting'}`;
  }

  return `latest:${postCount > 0 ? 'ready' : 'waiting'}`;
}
