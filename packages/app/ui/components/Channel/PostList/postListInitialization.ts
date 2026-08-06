import type { ScrollAnchor } from '../scrollerTypes';

export function getPostListAnchorKey(anchor?: ScrollAnchor | null) {
  return anchor ? `${anchor.type}:${anchor.postId}` : undefined;
}

export function getPostListInitialization({
  anchorKey,
  anchorIndex,
  didTimeoutWaitingForAnchor = false,
  isLoading = false,
}: {
  anchorKey?: string;
  anchorIndex: number;
  didTimeoutWaitingForAnchor?: boolean;
  isLoading?: boolean;
}) {
  // LegendList reads its initial scroll target only during mount, so the key
  // advances when an awaited anchor resolves (or falls back). This is a v1
  // bridge until readiness can be driven by measured-row quiescence.
  if (!anchorKey) {
    return {
      isAnchorReady: true,
      mountKey: 'latest',
      shouldStartAnchorTimeout: false,
    };
  }

  const resolution = didTimeoutWaitingForAnchor
    ? 'fallback'
    : anchorIndex !== -1
      ? 'ready'
      : 'waiting';
  return {
    isAnchorReady: resolution !== 'waiting',
    mountKey: `anchor:${anchorKey}:${resolution}`,
    shouldStartAnchorTimeout: resolution === 'waiting' && !isLoading,
  };
}
