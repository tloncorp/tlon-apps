import { useMutableCallback } from '@tloncorp/shared';
import {
  IntersectionObserverProvider,
  useIntersectionObserverContext,
} from '@tloncorp/shared/utils';
import { isEqual, min } from 'lodash';
import * as React from 'react';
import { View } from 'react-native';

import { useFeatureFlag } from '../../../../lib/featureFlags';
import { ScrollAnchor } from '../Scroller';
import { PostList as PostListNative } from './PostListFlatList';
import { PostListComponent, PostWithNeighbors } from './shared';

const FORCE_MANUAL_SCROLL_ANCHORING: boolean = false;

export const PostList: PostListComponent = React.forwardRef((props, ref) => {
  const [webScrollerEnabled] = useFeatureFlag('webScroller');

  if (webScrollerEnabled && props.numColumns === 1) {
    return <PostListSingleColumn {...props} ref={ref} />;
  } else {
    // Use the native implementation for multi-column lists
    return <PostListNative {...props} ref={ref} />;
  }
});
PostList.displayName = 'PostList';

const PostListSingleColumn: PostListComponent = React.forwardRef(
  (props, forwardedRef) => (
    <IntersectionObserverProvider>
      <_PostListSingleColumn {...props} ref={forwardedRef} />
    </IntersectionObserverProvider>
  )
);
PostListSingleColumn.displayName = 'PostListSingleColumn';

const _PostListSingleColumn: PostListComponent = React.forwardRef(
  (
    {
      anchor,
      // channel,
      // collectionLayoutType,
      // columnWrapperStyle,
      contentContainerStyle,
      hasNewerPosts = false,
      inverted = false,
      // numColumns,
      onEndReached,
      onEndReachedThreshold = 1,
      onInitialScrollCompleted,
      onScrolledToBottom,
      onScrolledToBottomThreshold = 1,
      onScrolledAwayFromBottom,
      onStartReached,
      onStartReachedThreshold = 1,
      postsWithNeighbors,
      renderEmptyComponent,
      renderItem,
      scrollEnabled = true,
      style,
    },
    forwardedRef
  ) => {
    const scrollerRef = React.useRef<HTMLDivElement | null>(null);
    const scrollerContentContainerRef = React.useRef<HTMLDivElement>(null);

    const { intersectingSetRef, setRoot } = useIntersectionObserverContext();
    // Immediately set the contextual intersection observer root to the scroller
    React.useEffect(() => setRoot(scrollerRef.current), [setRoot]);

    const orderedData = React.useMemo(
      () => (inverted ? [...postsWithNeighbors].reverse() : postsWithNeighbors),
      [inverted, postsWithNeighbors]
    );

    const getMinVisibleIndex = React.useCallback(
      () =>
        min(
          Array.from(intersectingSetRef.current).flatMap(
            (x) => getItemIndexFromPostListItem(x) ?? []
          )
        ),
      [intersectingSetRef]
    );

    useScrollToAnchorOnMount({
      anchor,
      scrollerRef,
      inverted,
      onScrollCompleted: onInitialScrollCompleted,
    });

    useManualScrollAnchoring({
      scrollerRef,
      scrollerContentContainerRef,
      scrollerContentsKey: orderedData,
      needsAnchoring: React.useCallback(
        (
          prev: typeof orderedData,
          next: typeof orderedData,
          scrollTop: number
        ) => {
          // https://caniuse.com/css-overflow-anchor
          const supportsScrollAnchoring = FORCE_MANUAL_SCROLL_ANCHORING
            ? false
            : CSS.supports('overflow-anchor', 'auto');

          if (supportsScrollAnchoring) {
            // If the browser natively implements scroll anchoring, use that
            // implementation whenever possible. The case that browser-based
            // scroll anchoring doesn't cover is when the user is already scrolled
            // all the way to the top and more content loads in at the top (e.g.
            // backfilling): in this case, we need to manually anchor the scroll.
            return (
              scrollTop === 0 && prev.at(0)?.post.id !== next.at(0)?.post.id
            );
          } else {
            // TODO: it'd be real nice to handle posts changing height!
            //
            // if (
            //   prev.length === next.length &&
            //   isPrefixEquivalent(prev, next, prev.length, isEqual)
            // ) {
            //   // If the previous and next data are equivalent, assume that
            //   // we're change height of a post above the viewport. This is as
            //   // likely as changing height of post below viewport, but idk,
            //   // seems like this assumption is a slightly better UX.
            //   return true;
            // }

            // If native scroll anchoring isn't available, manually anchor
            // scroll whenever the content above the viewport changes.
            //
            // This does not account for changes in *view content*, just data
            // content - so e.g. images loading after a second will not trigger
            // a scroll anchor, and will push the scroll down.
            const prefixLength = (getMinVisibleIndex() ?? 0) + 1;
            return !isPrefixEquivalent(prev, next, prefixLength, isEqual);
          }
        },
        [getMinVisibleIndex]
      ),
    });

    useBoundaryCallbacks({
      element: scrollerRef.current,
      inverted,
      onEndReached,
      onEndReachedThreshold,
      onStartReached,
      onStartReachedThreshold,
      scrollerContentKey: orderedData,
    });

    const [insideScrolledToBottomBoundary] = useScrollBoundary(
      scrollerRef.current,
      { boundaryRatio: onScrolledToBottomThreshold, side: 'bottom' }
    );
    React.useEffect(() => {
      if (insideScrolledToBottomBoundary) {
        onScrolledToBottom?.();
      } else {
        onScrolledAwayFromBottom?.();
      }
    }, [
      onScrolledAwayFromBottom,
      onScrolledToBottom,
      insideScrolledToBottomBoundary,
    ]);

    useStickToScrollStart({
      scrollerContentsKey: orderedData,
      scrollerRef,
      inverted,
      hasNewerPosts,
    });

    React.useImperativeHandle(forwardedRef, () => ({
      scrollToStart: ({ animated = true }) => {
        if (scrollerRef.current) {
          scrollerRef.current.scrollTo({
            top: inverted ? scrollerRef.current.scrollHeight : 0,
            behavior: animated ? 'smooth' : 'instant',
          });
        }
      },
      scrollToIndex: ({ index, animated = true }) => {
        const item = orderedData[index];
        if (item) {
          const element = scrollerContentContainerRef.current?.querySelector(
            `[data-postid="${item.post.id}"]`
          );
          if (element) {
            element.scrollIntoView({
              block: 'start',
              behavior: animated ? 'smooth' : 'instant',
            });
          }
        }
      },
    }));

    return (
      <View style={[{ flex: 1 }, style]}>
        <div
          ref={scrollerRef}
          style={{
            flex: 1,
            overflowY: scrollEnabled ? 'auto' : 'hidden',
            overflowAnchor: FORCE_MANUAL_SCROLL_ANCHORING ? 'none' : undefined,
          }}
        >
          <div
            ref={scrollerContentContainerRef}
            style={{
              display: 'flex',
              minHeight: '100%',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-end',
            }}
          >
            <View
              style={[
                {
                  flex: 1,
                  flexDirection: 'column',
                  justifyContent: inverted ? 'flex-end' : 'flex-start',
                },
                contentContainerStyle,
              ]}
            >
              {orderedData.map((item, index) => (
                <PostListItem key={item.post.id} item={item} index={index}>
                  {renderItem({ item, index })}
                </PostListItem>
              ))}

              {orderedData.length === 0 && (
                <View style={{ flex: 1 }}>{renderEmptyComponent?.()}</View>
              )}
            </View>
          </div>
        </div>
      </View>
    );
  }
);
_PostListSingleColumn.displayName = 'InternalPostListSingleColumn';

function PostListItem({
  item,
  index,
  children,
}: React.PropsWithChildren<{
  item: PostWithNeighbors;
  index: number;
}>) {
  const { observe } = useIntersectionObserverContext();
  // use `useState` to make sure we trigger the `observe()` effect on change
  const [ref, setRef] = React.useState<React.ElementRef<'div'> | null>(null);

  // register / unregister this element with the visibility tracker
  React.useEffect(() => {
    if (ref == null) {
      return;
    }
    const { unobserve } = observe(ref);
    return () => unobserve();
  }, [ref, observe]);

  return (
    <div
      ref={setRef}
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

/** Extracts data-itemindex from a PostListItem DOM element */
function getItemIndexFromPostListItem(element: Element): number | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const index = parseInt(element.dataset.itemindex ?? '');
  return isNaN(index) ? null : index;
}

function isElementScrolledNearTop(
  element: HTMLElement,
  boundaryRatio: number
): boolean {
  const distanceFromTop = element.scrollTop;
  const viewportHeight = element.clientHeight;
  const isNearTop = distanceFromTop / viewportHeight <= boundaryRatio;
  return isNearTop;
}
function isElementScrolledNearBottom(
  element: HTMLElement,
  boundaryRatio: number
): boolean {
  const distanceFromBottom =
    element.scrollHeight - (element.scrollTop + element.clientHeight);
  const viewportHeight = element.clientHeight;
  const isNearBottom = distanceFromBottom / viewportHeight <= boundaryRatio;
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
 * React.useEffect(() => {
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
    boundaryRatio,
    side,
  }: {
    /**
     * Max ratio of (distance to boundary) / (viewport height) that will be considered "near boundary".
     * e.g. `boundaryRatio: 0.5` means that `isNearTop` will be true once we're a half screen from the top of the scroll.
     */
    boundaryRatio: number;
    side: 'top' | 'bottom';
  }
) {
  const checkInsideBoundary = React.useCallback(() => {
    if (element == null) {
      return null;
    }
    const check =
      side === 'top' ? isElementScrolledNearTop : isElementScrolledNearBottom;
    return check(element, boundaryRatio);
  }, [element, side, boundaryRatio]);

  const [insideBoundary, setInsideBoundary] = React.useState(
    () => checkInsideBoundary() ?? false
  );
  React.useEffect(() => {
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
  }, [element, boundaryRatio, checkInsideBoundary]);
  return [insideBoundary, checkInsideBoundary] as const;
}

class ManualScrollAnchorCoordinator<ContentKey> {
  private resizeObserver: ResizeObserver | null = null;
  private previousScrollHeight: number | null = null;

  /**
   * Value of content key when scroll offset was last applied.
   * Since `null` could be a valid `ContentKey` value, use an ad-hoc box type - null is empty.
   */
  private previousKey: [ContentKey] | null = null;
  private currentKey: [ContentKey] | null = null;

  constructor(
    public scroller?: HTMLElement,
    public contentContainer?: HTMLElement,
    public checkNeedsAnchor?: (
      prevKey: ContentKey,
      nextKey: ContentKey,
      /** Scroll offset of anchoring scroll element */
      scrollTop: number
    ) => boolean
  ) {}

  setContentKey(contentKey: ContentKey) {
    this.currentKey = [contentKey];
  }

  install() {
    if (this.contentContainer == null) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === this.contentContainer) {
          this.checkAndApplyScrollOffset();
        }
      }
    });
    resizeObserver.observe(this.contentContainer);

    this.resizeObserver = resizeObserver;
  }

  uninstall() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.previousScrollHeight = null;
    this.previousKey = null;
  }

  private checkAndApplyScrollOffset() {
    if (this.contentContainer == null) {
      return;
    }

    const previousScrollHeight = this.previousScrollHeight;
    const currentScrollHeight = this.contentContainer.scrollHeight;
    this.previousScrollHeight = currentScrollHeight;

    const previousKey = this.previousKey;
    const currentKey = this.currentKey;
    this.previousKey = currentKey;

    if (
      previousScrollHeight == null ||
      previousKey == null ||
      currentKey == null ||
      this.scroller == null ||
      this.checkNeedsAnchor == null
    ) {
      return;
    }

    const needsAnchor = this.checkNeedsAnchor(
      previousKey[0],
      currentKey[0],
      this.scroller.scrollTop
    );

    if (!needsAnchor) {
      return;
    }

    const scrollHeightChange =
      this.scroller.scrollHeight - previousScrollHeight;

    if (scrollHeightChange === 0) {
      return;
    }

    this.scroller.scrollBy({ top: scrollHeightChange, behavior: 'instant' });
  }
}

function useManualScrollAnchoring<Data>({
  scrollerRef,
  scrollerContentContainerRef,
  scrollerContentsKey,
  needsAnchoring: checkNeedsAnchor,
}: {
  scrollerRef: React.RefObject<HTMLDivElement>;
  scrollerContentContainerRef: React.RefObject<HTMLDivElement>;
  /** This value must change when the scroll height of the scroller changes */
  scrollerContentsKey: Data;
  needsAnchoring: (
    prevKey: Data,
    nextKey: Data,
    /** Scroll offset of anchoring scroll element */
    scrollTop: number
  ) => boolean;
}) {
  const coordinator = React.useRef(
    new ManualScrollAnchorCoordinator<Data>(
      scrollerRef.current!,
      scrollerContentContainerRef.current!,
      checkNeedsAnchor
    )
  );

  React.useEffect(() => {
    const coord = coordinator.current;
    coord.scroller = scrollerRef.current ?? undefined;
    coord.contentContainer = scrollerContentContainerRef.current ?? undefined;
    coord.install();
    return () => coord.uninstall();
  }, [scrollerContentContainerRef, scrollerRef]);

  coordinator.current?.setContentKey(scrollerContentsKey);
}

function useStickToScrollStart({
  inverted,
  scrollerContentsKey,
  scrollerRef,
  hasNewerPosts,
}: {
  inverted: boolean;
  /** This value must change when the scroll height of the scroller changes */
  scrollerContentsKey: unknown;
  scrollerRef: React.RefObject<HTMLDivElement>;
  hasNewerPosts: boolean;
}) {
  const shouldStickToStartRef = React.useRef(false);

  const [isAtStart] = useScrollBoundary(scrollerRef.current, {
    boundaryRatio: 0,
    side: inverted ? 'bottom' : 'top',
  });

  React.useEffect(() => {
    shouldStickToStartRef.current = !hasNewerPosts && isAtStart;
  }, [isAtStart, hasNewerPosts]);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!shouldStickToStartRef.current || scroller == null) {
      return;
    }
    scroller.scrollTo({ top: inverted ? scroller.scrollHeight : 0 });
  }, [scrollerRef, scrollerContentsKey, inverted]);
}

function useScrollToAnchorOnMount({
  anchor,
  scrollerRef,
  inverted,
  onScrollCompleted,
}: {
  anchor: ScrollAnchor | null | undefined;
  scrollerRef: React.RefObject<HTMLDivElement>;
  inverted: boolean;
  onScrollCompleted?: () => void;
}) {
  const needsInitialScrollRef = React.useRef(true);
  React.useLayoutEffect(() => {
    if (!needsInitialScrollRef.current) {
      return;
    }
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    if (!anchor) {
      if (inverted) {
        scroller.scrollTo({ top: scroller.scrollHeight });
      }
    } else {
      const anchorElement = scroller.querySelector(
        `[data-postid="${anchor.postId}"]`
      );
      if (anchorElement) {
        anchorElement.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else {
        scroller.scrollTo({ top: scroller.scrollHeight });
      }
    }

    needsInitialScrollRef.current = false;
    onScrollCompleted?.();
  }, [scrollerRef, anchor, inverted, onScrollCompleted]);
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
  inverted,
  onEndReached,
  onEndReachedThreshold,
  onStartReached,
  onStartReachedThreshold,
  scrollerContentKey,
}: {
  element: HTMLElement | null;
  inverted: boolean;
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
    boundaryRatio: onStartReachedThreshold,
    side: inverted ? 'bottom' : 'top',
  });
  React.useEffect(() => {
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
    boundaryRatio: onEndReachedThreshold,
    side: inverted ? 'top' : 'bottom',
  });
  React.useEffect(() => {
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
 * Returns true if `xs.slice(0, prefixLength)` is equivalent to
 * `ys.slice(0, prefixLength)` using the provided equality function (short
 * circuiting if not equal).
 */
function isPrefixEquivalent<T>(
  xs: T[],
  ys: T[],
  prefixLength: number,
  isEqual: (a: T, b: T) => boolean
): boolean {
  for (let i = 0; i < prefixLength; i++) {
    if (!isEqual(xs[i], ys[i])) {
      return false;
    }
  }
  return true;
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
  const lastKeyRef = React.useRef<[Key] | null>(null);
  const out = useMutableCallback(
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
  // @ts-ignore
  out.resetDeduplicateInvocation = React.useCallback((key: Key) => {
    lastKeyRef.current = [key];
  }, []);
  // @ts-ignore
  return out;
}
