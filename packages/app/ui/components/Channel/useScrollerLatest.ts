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
  permit: () => boolean;
  stillVisiting: () => boolean;
  canRetireAnchor: boolean;
  issued: boolean;
};

/** Owns the latest action; geometry notifications only control its presentation. */
export function useScrollerLatest({
  scrollVisit,
  conversationKey,
  entry,
  anchorKey,
  isReady,
  isLoading,
  hasNewerPosts,
  listRef,
  onPressScrollToBottom,
}: {
  scrollVisit: LifecyclePermit;
  conversationKey: string;
  entry: { active: boolean };
  anchorKey?: string;
  isReady: boolean;
  isLoading: boolean;
  hasNewerPosts: boolean;
  listRef: RefObject<PostListMethods | null>;
  onPressScrollToBottom?: () => void;
}) {
  const visit = useMemo(
    () => ({
      active: true,
      atBottom: true,
      anchorKey,
      request: null as LatestRequest | null,
      frame: undefined as number | undefined,
    }),
    [conversationKey]
  );
  const [, render] = useReducer((revision: number) => revision + 1, 0);
  const inputs = useRef({ isReady, isLoading, hasNewerPosts });

  useLayoutEffect(() => {
    visit.active = true;
    return () => {
      visit.active = false;
      visit.request = null;
      if (visit.frame !== undefined) cancelAnimationFrame(visit.frame);
      visit.frame = undefined;
    };
  }, [visit]);

  useLayoutEffect(
    () => () => {
      // A retained route may regain the same ID. Its old request is still
      // cancelled, and anchor retirement cannot grant it a new focus permit.
      visit.request = null;
      if (visit.frame !== undefined) cancelAnimationFrame(visit.frame);
      visit.frame = undefined;
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
        request.permit =
          listRef.current?.captureScrollIntent?.() ?? (() => true);
      } else {
        visit.request = null;
        if (visit.frame !== undefined) cancelAnimationFrame(visit.frame);
        visit.frame = undefined;
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
      !visit.request.stillVisiting()
    )
      return;
    const request = visit.request;
    const frame = requestAnimationFrame(() => {
      // Cancellation may be too late to prevent callback delivery. A stale
      // frame must neither consume a newer request nor clear its frame slot.
      if (visit.frame !== frame || visit.request !== request) return;
      visit.frame = undefined;
      if (!visit.active || request.issued) return;
      if (!request.stillVisiting() || !request.permit()) {
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
    if (!visit.active || !entry.active || !scrollVisit.isCurrent()) return;
    if (visit.frame !== undefined) cancelAnimationFrame(visit.frame);
    visit.frame = undefined;
    visit.request = {
      canRetireAnchor: visit.anchorKey !== undefined,
      issued: false,
      stillVisiting: scrollVisit.capture(),
      permit: listRef.current?.captureScrollIntent?.() ?? (() => true),
    };
    render();
    onPressScrollToBottom?.();
    scheduleLatest();
  }, [
    entry,
    listRef,
    onPressScrollToBottom,
    scheduleLatest,
    scrollVisit,
    visit,
  ]);

  const onScrolledToBottom = useCallback(() => {
    if (!visit.active || !entry.active) return;
    visit.atBottom = true;
    if (visit.request?.issued) visit.request = null;
    render();
  }, [entry, visit]);
  const onScrolledAwayFromBottom = useCallback(() => {
    if (!visit.active || !entry.active) return;
    visit.atBottom = false;
    render();
  }, [entry, visit]);

  const cancel = useCallback(() => {
    if (
      !visit.active ||
      !entry.active ||
      !scrollVisit.isCurrent() ||
      !visit.request
    )
      return;
    visit.request = null;
    if (visit.frame !== undefined) {
      cancelAnimationFrame(visit.frame);
      visit.frame = undefined;
    }
    render();
  }, [entry, scrollVisit, visit]);

  return {
    atBottom: visit.atBottom,
    loading: isLoading && visit.request !== null,
    onPress,
    onScrolledToBottom,
    onScrolledAwayFromBottom,
    cancel,
  };
}
