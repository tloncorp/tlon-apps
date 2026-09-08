import { useMutableCallback } from '@tloncorp/shared';
import { isEqual, memoize } from 'lodash';
import * as React from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { View } from 'react-native';

import type { LifecyclePermit } from '../../../../hooks/useLifecyclePermit';
import { useConversationScrollEndAnchor } from '../../../contexts/scroll';

import { ScrollAnchor } from '../Scroller';
import { PostList as PostListFlatList } from './PostListFlatList';
import { getPostListScopeKey } from './postListInitialization';
import {
  listScrollKeyDirection,
  listScrollWheelDirection,
  useWebScrollCoordinator,
} from './useWebScrollCoordinator';
import {
  getWebInitialAnchorOffset,
  getWebPostTargetOffset,
  isWebScrollSurfaceVisible,
} from './webReadingAnchor';
import type { WebScrollCoordinator } from './webScrollCoordinator';
import {
  PostListComponent,
  PostListMethods,
  PostWithNeighbors,
  usePostListBottomCallbacks,
} from './shared';

export const PostList: PostListComponent = React.forwardRef(
  (props, forwardedRef) => {
    return props.numColumns === 1 ? (
      <PostListSingleColumn {...props} ref={forwardedRef} />
    ) : (
      <PostListGrid {...props} ref={forwardedRef} />
    );
  }
);
PostList.displayName = 'PostList';

// FlatList owns grid geometry. Keep its asynchronous-send permission scoped to
// the real visible web surface instead of falling through an unsupported port.
const PostListGrid: PostListComponent = React.forwardRef(
  (props, forwardedRef) => {
    const list = useRef<PostListMethods>(null);
    const surface = useRef<HTMLDivElement>(null);
    const revision = useRef(0);
    const alive = useRef(true);
    const focused = useRef(props.isFocused !== false);
    const scope = getPostListScopeKey(props.channel.id, props.anchor);
    const currentScope = useRef(scope);
    useLayoutEffect(() => {
      currentScope.current = scope;
      revision.current++;
    }, [scope]);
    useLayoutEffect(() => {
      alive.current = true;
      return () => {
        alive.current = false;
        revision.current++;
      };
    }, []);
    useLayoutEffect(() => {
      focused.current = props.isFocused !== false;
      revision.current++;
    }, [props.isFocused]);
    const canNavigate = () =>
      alive.current &&
      focused.current &&
      (props.scrollVisit?.isCurrent() ?? true) &&
      !!surface.current &&
      isWebScrollSurfaceVisible(surface.current);
    const revoke = () => {
      revision.current++;
      props.onScrollIntentChanged?.();
    };
    React.useImperativeHandle(forwardedRef, () => ({
      captureScrollIntent: () => {
        const captured = revision.current;
        const visit = currentScope.current;
        const childValid = list.current?.captureScrollIntent?.();
        const visitValid = props.scrollVisit?.capture();
        const capturedFocused = focused.current;
        return () =>
          capturedFocused &&
          focused.current &&
          (visitValid?.() ?? true) &&
          (!childValid || childValid()) &&
          alive.current &&
          currentScope.current === visit &&
          captured === revision.current &&
          !!surface.current &&
          isWebScrollSurfaceVisible(surface.current);
      },
      scrollToStart: (options) => {
        if (!canNavigate()) return;
        revoke();
        list.current?.scrollToStart(options);
      },
      scrollToEnd: (options) => {
        if (!canNavigate()) return;
        revoke();
        list.current?.scrollToEnd(options);
      },
      scrollToPost: (options) => {
        if (!canNavigate()) return;
        revoke();
        list.current?.scrollToPost(options);
      },
    }));
    return (
      <div
        ref={surface}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}
        onWheelCapture={(event) => {
          if (listScrollWheelDirection(event.nativeEvent) !== null) revoke();
        }}
        onKeyDownCapture={(event) => {
          if (
            event.isTrusted &&
            listScrollKeyDirection(event.nativeEvent) !== null
          )
            revoke();
        }}
        onPointerDownCapture={(event) => {
          const target = event.target;
          if (
            event.isTrusted &&
            target instanceof HTMLElement &&
            target.scrollHeight > target.clientHeight &&
            /auto|scroll/.test(getComputedStyle(target).overflowY)
          )
            revoke();
        }}
        // FlatList doesn't expose scroll origin here; conservatively invalidate
        // deferred work after any movement, including assistive scrolling.
        onScrollCapture={() => {
          revision.current++;
        }}
      >
        <PostListFlatList
          key={
            props.anchor?.type === 'selected' ? props.anchor.postId : undefined
          }
          {...props}
          ref={list}
        />
      </div>
    );
  }
);
PostListGrid.displayName = 'PostListGrid';

const PostListSingleColumn: PostListComponent = React.forwardRef(
  (
    {
      anchor,
      channel,
      // collectionLayoutType,
      contentContainerStyle,
      hasNewerPosts = false,
      anchorToEnd = false,
      onEndReached,
      onEndReachedThreshold = 1,
      onInitialScrollPending,
      onInitialScrollCompleted,
      onScrolledToBottom,
      onScrolledToBottomThreshold = 1,
      onScrolledAwayFromBottom,
      onScrollIntentChanged,
      isFocused = true,
      scrollVisit,
      onStartReached,
      onStartReachedThreshold = 1,
      postsWithNeighbors,
      renderEmptyComponent,
      renderItem,
      scrollEnabled = true,
      style,
      listHeaderComponent,
      listBottomComponent,
    },
    forwardedRef
  ) => {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const scrollerContentContainerRef = useRef<HTMLDivElement>(null);

    const orderedData = postsWithNeighbors;

    const hasInFlightPost = postsWithNeighbors.some(
      ({ post }) =>
        post.deliveryStatus === 'pending' || post.deliveryStatus === 'enqueued'
    );
    const initializationKey = getPostListScopeKey(channel.id, anchor);
    const coordinatorRef = useWebScrollCoordinator({
      scrollerRef,
      contentRef: scrollerContentContainerRef,
      scope: initializationKey,
      anchorToEnd,
      followBlocked: hasNewerPosts && !hasInFlightPost,
      onScrollIntentChanged,
      isFocused,
    });
    const endAnchor = useConversationScrollEndAnchor();
    useLayoutEffect(() => {
      let captured: (() => boolean) | undefined;
      return endAnchor?.register({
        capture: () => {
          captured = coordinatorRef.current?.captureScrollIntent();
        },
        restore: () => {
          const current = captured;
          captured = undefined;
          if (current?.()) coordinatorRef.current?.reconcile();
        },
        // The input changes its DOM height synchronously. Reconcile before
        // returning to input observers; external layouts still use ResizeObserver.
        layoutChanged: () => coordinatorRef.current?.reconcile(),
      });
    }, [coordinatorRef, endAnchor]);
    useScrollToAnchorOnMount({
      anchor,
      scrollerRef,
      coordinatorRef,
      anchorToEnd,
      onScrollCompleted: onInitialScrollCompleted,
      onScrollPending: onInitialScrollPending,
      contentKey: `${orderedData.length}:${orderedData[0]?.post.id ?? ''}:${orderedData[orderedData.length - 1]?.post.id ?? ''}`,
      initializationKey,
      isFocused,
      scrollVisit,
    });

    const scrollHeight =
      useTrackContentRect(scrollerContentContainerRef.current)?.height ?? 0;
    useBoundaryCallbacks({
      element: scrollerRef.current,
      onEndReached,
      onEndReachedThreshold,
      onStartReached,
      onStartReachedThreshold,
      scrollerContentKey: scrollHeight,
    });

    // Latest visibility uses the same absolute distance as the native lists.
    // Pagination boundaries below intentionally remain viewport ratios.
    const withinBottomDistance = React.useCallback(
      (distance: number) => distance <= onScrolledToBottomThreshold,
      [onScrolledToBottomThreshold]
    );
    const [insideScrolledToBottomBoundary] = useScrollBoundary(
      scrollerRef.current,
      {
        isNearBoundary: withinBottomDistance,
        side: 'bottom',
      }
    );
    usePostListBottomCallbacks(insideScrolledToBottomBoundary, {
      onScrolledToBottom,
      onScrolledAwayFromBottom,
    });

    React.useImperativeHandle(forwardedRef, () => ({
      captureScrollIntent: () => {
        const visitValid = scrollVisit?.capture();
        const rendererValid = coordinatorRef.current?.captureScrollIntent();
        return () =>
          isFocused && (visitValid?.() ?? true) && (rendererValid?.() ?? false);
      },
      scrollToStart: ({ animated = true }) => {
        if (!isFocused || (scrollVisit && !scrollVisit.isCurrent())) return;
        coordinatorRef.current?.navigate(() => 0, animated, !anchorToEnd);
      },
      scrollToEnd: ({ animated = true }) => {
        if (!isFocused || (scrollVisit && !scrollVisit.isCurrent())) return;
        const scroller = scrollerRef.current;
        if (scroller)
          coordinatorRef.current?.navigate(
            () => scroller.scrollHeight - scroller.clientHeight,
            animated,
            anchorToEnd
          );
      },
      scrollToPost: ({ postId, animated = true, viewPosition = 0.5 }) => {
        if (!isFocused || (scrollVisit && !scrollVisit.isCurrent())) return;
        const scroller = scrollerRef.current;
        if (scroller)
          coordinatorRef.current?.navigate(
            () => getWebPostTargetOffset(scroller, postId, viewPosition),
            animated
          );
      },
    }));

    return (
      <View style={[{ flex: 1 }, style]}>
        <div
          ref={scrollerRef}
          tabIndex={0}
          style={{
            flex: 1,
            overflowY: scrollEnabled ? 'auto' : 'hidden',
            overflowAnchor: 'none',
          }}
        >
          <div
            ref={scrollerContentContainerRef}
            style={{
              display: 'flex',
              minHeight: '100%',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: anchorToEnd ? 'flex-end' : 'flex-start',
            }}
          >
            <View style={contentContainerStyle}>
              {listHeaderComponent}
              {orderedData.map((item, index) => (
                <PostListItem key={item.post.id} item={item} index={index}>
                  {renderItem({ item, index })}
                </PostListItem>
              ))}

              {orderedData.length === 0 && (
                <View style={{ flex: 1 }}>{renderEmptyComponent?.()}</View>
              )}
              {listBottomComponent}
            </View>
          </div>
        </div>
      </View>
    );
  }
);
PostListSingleColumn.displayName = 'PostListSingleColumn';

function PostListItem({
  item,
  index,
  children,
}: React.PropsWithChildren<{
  item: PostWithNeighbors;
  index: number;
}>) {
  return (
    <div
      data-postid={item.post.id}
      // Used when determining minVisibleIndex
      data-itemindex={index}
      style={{
        // Without this, our ChatMessageActions trigger button can add to the
        // scroll height, causing jumps to scroll height on message hover.
        contain: 'layout',
      }}
    >
      {children}
    </div>
  );
}

function isElementScrolledNearTop(
  element: HTMLElement,
  isNearBoundary: (distance: number, viewportHeight: number) => boolean
): boolean {
  const distanceFromTop = element.scrollTop;
  const viewportHeight = element.clientHeight;
  const isNearTop = isNearBoundary(distanceFromTop, viewportHeight);
  return isNearTop;
}
function isElementScrolledNearBottom(
  element: HTMLElement,
  isNearBoundary: (distance: number, viewportHeight: number) => boolean
): boolean {
  const distanceFromBottom =
    element.scrollHeight - (element.scrollTop + element.clientHeight);
  const viewportHeight = element.clientHeight;
  const isNearBottom = isNearBoundary(distanceFromBottom, viewportHeight);
  return isNearBottom;
}

/**
 * Returns a tuple of:
 * 0. a boolean which is true if `element` is scrolled within
 *    `boundaryRatio * element.clientHeight` of `side`, else false
 * 1. a function that can be used to get the current value of (0), in case it
 *    has changed since last render
 *
 * ```ts
 * const [isNearTop, checkIsNearTop] = useScrollBoundary(
 *   scroller,
 *   { boundaryRatio: 0.2, side: 'top' }
 * );
 *
 * useEffect(() => {
 *   // using `checkIsNearTop()` here avoids running the effect if the scroll
 *   // position has changed since the effect was enqueued
 *   if (checkIsNearTop()) {
 *     // do something
 *   }
 * }, [
 *   // it's still necessary to include `isNearTop` in the dependency array
 *   // since `checkIsNearTop` doesn't change identity when `isNearTop` does
 *   isNearTop,
 *   checkIsNearTop
 * ]);
 * ```
 *
 * Without using the `checkIsNearTop` function, hooks triggering on
 * `isNearTop` that change the scroll contents are likely to incorrectly
 * double-trigger.
 */
function useScrollBoundary(
  element: HTMLElement | null,
  {
    isNearBoundary,
    side,
  }: {
    isNearBoundary: (distance: number, viewportHeight: number) => boolean;
    side: 'top' | 'bottom';
  }
) {
  const checkInsideBoundary = React.useCallback(() => {
    if (element == null) {
      return null;
    }
    const check =
      side === 'top' ? isElementScrolledNearTop : isElementScrolledNearBottom;
    return check(element, isNearBoundary);
  }, [element, side, isNearBoundary]);

  const [insideBoundary, setInsideBoundary] = React.useState(
    () => checkInsideBoundary() ?? false
  );
  useEffect(() => {
    if (element == null) {
      return;
    }
    const handleScroll = () => {
      setInsideBoundary(checkInsideBoundary() ?? false);
    };
    element.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [element, checkInsideBoundary]);
  return [insideBoundary, checkInsideBoundary] as const;
}

function useScrollToAnchorOnMount({
  anchor,
  scrollerRef,
  coordinatorRef,
  anchorToEnd,
  onScrollCompleted,
  onScrollPending,
  contentKey,
  initializationKey,
  isFocused,
  scrollVisit,
}: {
  anchor: ScrollAnchor | null | undefined;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  coordinatorRef: React.RefObject<WebScrollCoordinator | null>;
  anchorToEnd: boolean;
  onScrollCompleted?: () => void;
  onScrollPending?: () => void;
  contentKey: string | number;
  initializationKey: string;
  isFocused: boolean;
  scrollVisit?: LifecyclePermit;
}) {
  const needsInitialScrollRef = useRef(true);
  const initialIntentRef = useRef<(() => boolean) | undefined>(undefined);
  const initialVisitRef = useRef<(() => boolean) | undefined>(undefined);
  const firstAttemptRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    needsInitialScrollRef.current = true;
    initialIntentRef.current = coordinatorRef.current?.captureScrollIntent();
    initialVisitRef.current = scrollVisit?.capture();
    firstAttemptRef.current = true;
    onScrollPending?.();
  }, [initializationKey, onScrollPending]);

  // Timeout fallback: give up after 5s if anchor element never appears
  useEffect(() => {
    if (!anchor?.postId || !needsInitialScrollRef.current) {
      return;
    }
    timeoutRef.current = setTimeout(() => {
      if (
        needsInitialScrollRef.current &&
        initialIntentRef.current?.() &&
        (initialVisitRef.current?.() ?? true)
      ) {
        // Unblock Scroller loading behavior so more content can load
        // (which may bring in the anchor post), but do NOT abandon the
        // anchor — the contentKey-driven retry will keep looking.
        onScrollCompleted?.();
      }
    }, 5000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [anchor?.postId, initializationKey, onScrollCompleted]);

  // Main scroll effect — re-runs when contentKey changes (as new posts render)
  useLayoutEffect(() => {
    if (!needsInitialScrollRef.current) return;
    const scroller = scrollerRef.current;
    const coordinator = coordinatorRef.current;
    if (!scroller || !coordinator) return;
    const firstAttempt = firstAttemptRef.current;
    firstAttemptRef.current = false;
    // A child layout effect precedes the parent's visit activation. Only this
    // initial synchronous attempt uses explicit focus; every later retry needs
    // the exact captured activation, never a refreshed same-channel permit.
    if (
      !isFocused ||
      !initialIntentRef.current?.() ||
      (!firstAttempt && !(initialVisitRef.current?.() ?? true))
    ) {
      needsInitialScrollRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onScrollCompleted?.();
      return;
    }

    if (!anchor) {
      coordinator.goToEdge(false, false);
      needsInitialScrollRef.current = false;
      onScrollCompleted?.();
      return;
    }

    const anchorElement = scroller.querySelector(
      `[data-postid="${anchor.postId}"]`
    );
    if (anchorElement) {
      coordinator.navigate(
        () => getWebInitialAnchorOffset(scroller, anchor),
        false,
        false,
        false
      );
      needsInitialScrollRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onScrollCompleted?.();
    }
    // else: element not in DOM yet — do nothing, wait for next contentKey change
  }, [
    scrollerRef,
    anchor,
    anchorToEnd,
    onScrollCompleted,
    contentKey,
    isFocused,
  ]);
}

// Pass this to useDeduplicateInvocationBy().resetDeduplicateInvocation() to
// force the next invocation of the guarded callback to be called.
const KEY_TO_PASSTHROUGH_NEXT_INVOCATION = Symbol();

/**
 * Calls appropriate callback when approaching boundary. Guards against
 * calling a callback twice for the same content size (i.e. only asks for more
 * content after the content has changed).
 *
 * Here's RN's implementation of this logic:
 * https://github.com/facebook/react-native/blob/18f4db44ef109668dc1e59180dd4ed8bf275e6f5/packages/virtualized-lists/Lists/VirtualizedList.js#L1519
 */
function useBoundaryCallbacks({
  element,
  onEndReached,
  onEndReachedThreshold,
  onStartReached,
  onStartReachedThreshold,
  scrollerContentKey,
}: {
  element: HTMLElement | null;
  onEndReached?: () => void;
  onEndReachedThreshold: number;
  onStartReached?: () => void;
  onStartReachedThreshold: number;
  /**
   * should change when the content of the scroller changes.
   */
  scrollerContentKey: unknown;
}) {
  const onStartReachedGuarded = useDeduplicateInvocationBy(
    () => scrollerContentKey,
    isEqual,
    onStartReached ?? null
  );
  const [reachedStart, getReachedStart] = useScrollBoundary(element, {
    isNearBoundary: withinViewportRatioOfBoundary(onStartReachedThreshold),
    side: 'top',
  });
  useEffect(() => {
    if (getReachedStart() ?? false) {
      onStartReachedGuarded?.();
    } else {
      // If user scrolled away from the boundary, make sure we always allow the
      // next invocation (i.e. we never skip it).
      // https://github.com/facebook/react-native/blob/18f4db44ef109668dc1e59180dd4ed8bf275e6f5/packages/virtualized-lists/Lists/VirtualizedList.js#L1598-L1605
      onStartReachedGuarded.resetDeduplicateInvocation(
        KEY_TO_PASSTHROUGH_NEXT_INVOCATION
      );
    }
  }, [
    getReachedStart,
    reachedStart,
    onStartReachedGuarded,

    // Perhaps surprisingly, we do want to trigger on `scrollerContentKey` to
    // handle the first few page loads. Without this dep, the following situation
    // can occur:
    // 1. List opens on a tall viewport, so that we immediately trigger an
    //   `onStartReached` (based on scroll position) to load more content
    // 2. More content is added to the scroll, increasing its content height -
    //   but even with the new content, there's not enough height for the
    //   viewport to scroll "away" from start (i.e. `scrollHeight <
    //   viewportHeight * (1 + onStartReachedThreshold)`)
    // 3. No matter how the user scrolls, `reachedStart` will always be true,
    //   so `onStartReachedGuarded` will never be called again
    scrollerContentKey,
  ]);

  const onEndReachedGuarded = useDeduplicateInvocationBy(
    () => scrollerContentKey,
    isEqual,
    onEndReached ?? null
  );
  const [reachedEnd, getReachedEnd] = useScrollBoundary(element, {
    isNearBoundary: withinViewportRatioOfBoundary(onEndReachedThreshold),
    side: 'bottom',
  });
  useEffect(() => {
    if (getReachedEnd() ?? false) {
      onEndReachedGuarded?.();
    } else {
      // If user scrolled away from the boundary, make sure we always allow the
      // next invocation (i.e. we never skip it).
      onEndReachedGuarded.resetDeduplicateInvocation(
        KEY_TO_PASSTHROUGH_NEXT_INVOCATION
      );
    }
  }, [
    getReachedEnd,
    reachedEnd,
    onEndReachedGuarded,
    // this is needed - see comment in in corresponding "reached start" code above
    scrollerContentKey,
  ]);
}

/**
 * Given a key getter and an action, returns a function that samples the key
 * getter whenever the action is invoked, and only runs the action if the key
 * has changed since the last invocation.
 * Returned callback returns true if the action was successfully called, or
 * false if it was deduplicated.
 *
 * ```ts
 * // `throttled` will only be run at max once per second
 * const throttled = useDeduplicateInvocationBy(
 *   () => Math.floor(Date.now() / 1000),
 *   doSomething
 * )
 * ```
 */
function useDeduplicateInvocationBy<Key>(
  getKey: () => Key,
  shouldSkip: (prev: Key, curr: Key) => boolean,
  callback: ((key: Key) => void) | null
): (() => boolean) & { resetDeduplicateInvocation: (key: Key) => void } {
  const lastKeyRef = useRef<[Key] | null>(null);
  // @ts-expect-error - resetDeduplicateInvocation is added below; idk how to do this in one step
  const out: (() => boolean) & {
    resetDeduplicateInvocation: (key: Key) => void;
  } = useMutableCallback(
    React.useCallback(() => {
      if (callback == null) {
        return false;
      }
      const key = getKey();
      if (
        lastKeyRef.current != null &&
        shouldSkip(lastKeyRef.current[0], key)
      ) {
        return false; // Callback already called for this key
      }
      lastKeyRef.current = [key];
      callback?.(key);
      return true; // Callback successfully called
    }, [getKey, callback, shouldSkip])
  );
  out.resetDeduplicateInvocation = React.useCallback((key: Key) => {
    lastKeyRef.current = [key];
  }, []);
  return out;
}

function useTrackContentRect(element: HTMLElement | null) {
  const [contentRect, setContentRect] = React.useState<DOMRectReadOnly | null>(
    null
  );
  const resizeObserver = React.useMemo(
    () =>
      new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === element) {
            setContentRect(entry.contentRect);
          }
        }
      }),
    [element]
  );
  useEffect(() => {
    if (element) {
      resizeObserver.observe(element);
      return () => resizeObserver.unobserve(element);
    }
  }, [resizeObserver, element]);
  return contentRect;
}

/**
 * Returns a function for `useScrollBoundary`'s `isNearBoundary` that checks
 * if the distance to the boundary is within `viewportRatio * viewportHeight`.
 * Useful for matching the behavior of `VirtualizedList`'s
 * `onStartReachedThreshold` and `onEndReachedThreshold`, which are expressed as
 * ratios of the viewport height.
 */
const withinViewportRatioOfBoundary = memoize(
  (viewportRatio: number) =>
    (distance: number, viewportHeight: number): boolean =>
      distance / viewportHeight <= viewportRatio
);
