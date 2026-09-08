import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import type { RefObject } from 'react';

import type { LifecyclePermit } from '../../../hooks/useLifecyclePermit';
import type { PostListMethods } from './PostList/shared';

type LatestRequest = {
  ownsListIntent: () => boolean;
  ownsFocusedVisit: () => boolean;
  canRetireAnchor: boolean;
  issued: boolean;
};

type LatestVisit = {
  active: boolean;
  atBottom: boolean;
  anchorKey?: string;
  request: LatestRequest | null;
  frame?: number;
};

function cancelLatestFrame(visit: LatestVisit) {
  if (visit.frame !== undefined) cancelAnimationFrame(visit.frame);
  visit.frame = undefined;
}

function retireLatestRequest(visit: LatestVisit) {
  visit.request = null;
  cancelLatestFrame(visit);
}

/** Owns the latest action; geometry notifications only control its presentation. */
export function useScrollerLatest({
  scrollVisit,
  conversationKey,
  isEntryActive,
  anchorKey,
  isReady,
  isLoading,
  hasNewerPosts,
  listRef,
  onPressScrollToBottom,
}: {
  scrollVisit: LifecyclePermit;
  conversationKey: string;
  isEntryActive: () => boolean;
  anchorKey?: string;
  isReady: boolean;
  isLoading: boolean;
  hasNewerPosts: boolean;
  listRef: RefObject<PostListMethods | null>;
  onPressScrollToBottom?: () => void;
}) {
  const visit = useMemo<LatestVisit>(
    () => ({
      active: true,
      atBottom: true,
      anchorKey,
      request: null,
      frame: undefined,
    }),
    [conversationKey]
  );
  const [, render] = useReducer((revision: number) => revision + 1, 0);
  const inputs = useRef({ isReady, isLoading, hasNewerPosts });

  useLayoutEffect(() => {
    visit.active = true;
    return () => {
      visit.active = false;
      retireLatestRequest(visit);
    };
  }, [visit]);

  useLayoutEffect(
    () => () => {
      // A retained route may regain the same ID. Its old request is still
      // cancelled, and anchor retirement cannot grant it a new focus permit.
      retireLatestRequest(visit);
    },
    [scrollVisit, visit]
  );

  useLayoutEffect(() => {
    inputs.current = { isReady, isLoading, hasNewerPosts };
    if (visit.anchorKey !== anchorKey) {
      const request = visit.request;
      if (request?.canRetireAnchor && anchorKey === undefined) {
        // Latest deliberately retires its own selected/unread cursor. The
        // replacement list is part of that action, not a new navigation.
        request.canRetireAnchor = false;
        request.ownsListIntent =
          listRef.current?.captureScrollIntent?.() ?? (() => true);
      } else {
        retireLatestRequest(visit);
      }
      visit.anchorKey = anchorKey;
    }
  }, [anchorKey, hasNewerPosts, isLoading, isReady, listRef, visit]);

  const scheduleLatest = useCallback(() => {
    if (
      !scrollVisit.isCurrent() ||
      visit.frame !== undefined ||
      !visit.request ||
      visit.request.issued ||
      !visit.request.ownsFocusedVisit()
    )
      return;
    const request = visit.request;
    const frame = requestAnimationFrame(() => {
      // Cancellation may be too late to prevent callback delivery. A stale
      // frame must neither consume a newer request nor clear its frame slot.
      if (visit.frame !== frame || visit.request !== request) return;
      visit.frame = undefined;
      if (!visit.active || request.issued) return;
      if (!request.ownsFocusedVisit() || !request.ownsListIntent()) {
        visit.request = null;
        render();
        return;
      }
      const current = inputs.current;
      if (!current.isReady || current.isLoading || current.hasNewerPosts)
        return;
      request.issued = true;
      listRef.current?.scrollToEnd({ animated: true });
    });
    visit.frame = frame;
  }, [listRef, scrollVisit, visit]);

  useLayoutEffect(() => {
    if (isReady && !isLoading && !hasNewerPosts) scheduleLatest();
  }, [hasNewerPosts, isLoading, isReady, scheduleLatest]);

  const onPress = useCallback(() => {
    if (!visit.active || !isEntryActive() || !scrollVisit.isCurrent()) return;
    cancelLatestFrame(visit);
    visit.request = {
      canRetireAnchor: visit.anchorKey !== undefined,
      issued: false,
      ownsFocusedVisit: scrollVisit.capture(),
      ownsListIntent: listRef.current?.captureScrollIntent?.() ?? (() => true),
    };
    render();
    onPressScrollToBottom?.();
    scheduleLatest();
  }, [
    isEntryActive,
    listRef,
    onPressScrollToBottom,
    scheduleLatest,
    scrollVisit,
    visit,
  ]);

  const onScrolledToBottom = useCallback(() => {
    if (!visit.active || !isEntryActive()) return;
    visit.atBottom = true;
    if (visit.request?.issued) visit.request = null;
    render();
  }, [isEntryActive, visit]);
  const onScrolledAwayFromBottom = useCallback(() => {
    if (!visit.active || !isEntryActive()) return;
    visit.atBottom = false;
    render();
  }, [isEntryActive, visit]);

  const cancel = useCallback(() => {
    if (
      !visit.active ||
      !isEntryActive() ||
      !scrollVisit.isCurrent() ||
      !visit.request
    )
      return;
    retireLatestRequest(visit);
    render();
  }, [isEntryActive, scrollVisit, visit]);

  return {
    atBottom: visit.atBottom,
    loading: isLoading && visit.request !== null,
    onPress,
    onScrolledToBottom,
    onScrolledAwayFromBottom,
    cancel,
  };
}
