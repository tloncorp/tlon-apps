import {
  IntersectionObserverProvider,
  useIntersectionObserverContext,
} from '@tloncorp/shared/utils';
import { isEqual, min } from 'lodash';
import * as React from 'react';
import { View } from 'react-native';

import { ScrollAnchor } from '../Scroller';
import { PostList as PostListNative } from './PostListFlatList';
import { PostListComponent, PostWithNeighbors } from './shared';

export const PostList: PostListComponent = React.forwardRef((props, ref) => {
  if (props.numColumns === 1) {
    return <PostListSingleColumn {...props} ref={ref} />;
  } else {
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
      onInitialScrollCompleted,
      onScrolledToBottom,
      onScrolledAwayFromBottom,
      onStartReached,
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

    const orderedData = React.useMemo(
      () => (inverted ? [...postsWithNeighbors].reverse() : postsWithNeighbors),
      [inverted, postsWithNeighbors]
    );
    const { intersectingSet, setRoot } = useIntersectionObserverContext();
    React.useEffect(() => {
      setRoot(scrollerRef.current);
    }, [setRoot]);

    const minVisibleIndex = React.useMemo(
      () =>
        min(
          Array.from(intersectingSet).flatMap((x) => {
            if (!(x instanceof HTMLElement)) {
              return [];
            }
            const index = parseInt(x.dataset.itemindex ?? '');
            if (isNaN(index)) {
              return [];
            }
            return index;
          })
        ),
      [intersectingSet]
    );

    useScrollToAnchorOnMount({
      anchor,
      scrollerRef,
      inverted,
      onScrollCompleted: onInitialScrollCompleted,
    });
    const { setShouldStickToScrollStart } = useStickToScrollStart({
      scrollerContentsKey: orderedData,
      scrollerRef,
      inverted,
    });
    useManualScrollAnchoring({
      scrollerRef,
      scrollerContentContainerRef,
      inverted,
      scrollerContentsKey: orderedData,
      needsAnchoring: React.useCallback(
        (
          prev: PostWithNeighbors[],
          next: PostWithNeighbors[],
          scrollTop: number
        ) => {
          // https://caniuse.com/css-overflow-anchor
          const supportsScrollAnchoring = CSS.supports(
            'overflow-anchor',
            'auto'
          );

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
            // If native scroll anchoring isn't available, manually anchor
            // scroll whenever the content above the viewport changes.
            const prefixLength = (minVisibleIndex ?? 0) + 1;
            return !isPrefixEquivalent(prev, next, prefixLength, isEqual);
          }
        },
        [minVisibleIndex]
      ),
    });

    const scrollBoundaries = useScrollBoundaries(scrollerRef.current, {
      boundaryRatio: 0.2,
    });
    useBoundaryCallbacks({
      onTopReached: inverted ? onEndReached : onStartReached,
      onBottomReached: inverted ? onStartReached : onEndReached,
      scrollerRef,
      scrollBoundaries,
    });

    React.useEffect(() => {
      if (scrollBoundaries.isAtBottom) {
        onScrolledToBottom?.();
      } else {
        onScrolledAwayFromBottom?.();
      }
    }, [
      onScrolledAwayFromBottom,
      onScrolledToBottom,
      scrollBoundaries.isAtBottom,
      inverted,
    ]);

    const isAtStart = inverted
      ? scrollBoundaries.isAtBottom
      : scrollBoundaries.isAtTop;
    React.useEffect(() => {
      setShouldStickToScrollStart(!hasNewerPosts && isAtStart);
    }, [setShouldStickToScrollStart, isAtStart, hasNewerPosts]);

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
          }}
        >
          <div
            ref={scrollerContentContainerRef}
            style={{
              display: 'flex',
              minHeight: '100%',
              flexDirection: 'column',
              justifyContent: 'stretch',
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
    >
      {children}
    </div>
  );
}

function isElementScrolledToTop(
  element: HTMLElement,
  boundaryRatio: number
): boolean {
  const distanceFromTop = element.scrollTop;
  const viewportHeight = element.clientHeight;
  const isAtTop = distanceFromTop / viewportHeight <= boundaryRatio;
  return isAtTop;
}
function isElementScrolledToBottom(
  element: HTMLElement,
  boundaryRatio: number
): boolean {
  const distanceFromBottom =
    element.scrollHeight - (element.scrollTop + element.clientHeight);
  const viewportHeight = element.clientHeight;
  const isAtBottom = distanceFromBottom / viewportHeight <= boundaryRatio;
  return isAtBottom;
}

function useScrollBoundaries(
  element: HTMLElement | null,
  {
    boundaryRatio,
  }: {
    /**
     * Max ratio of (distance to boundary) / (viewport height) that will be considered "at boundary".
     * e.g. `boundaryRatio: 0.5` means that `isAtTop` will be true once we're a half screen from the top of the scroll.
     */
    boundaryRatio: number;
  }
) {
  const [isAtTop, setIsAtTop] = React.useState(() =>
    element == null ? false : isElementScrolledToTop(element, boundaryRatio)
  );
  const [isAtBottom, setIsAtBottom] = React.useState(() =>
    element == null ? false : isElementScrolledToBottom(element, boundaryRatio)
  );

  React.useEffect(() => {
    if (element == null) {
      return;
    }

    const handleScroll = () => {
      setIsAtTop(isElementScrolledToTop(element, boundaryRatio));
      setIsAtBottom(isElementScrolledToBottom(element, boundaryRatio));
    };
    element.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [element, boundaryRatio]);

  return {
    isAtTop,
    isAtBottom,
  };
}

function useManualScrollAnchoring<Data>({
  scrollerRef,
  scrollerContentContainerRef,
  inverted,
  scrollerContentsKey,
  needsAnchoring: checkNeedsAnchor,
}: {
  scrollerRef: React.RefObject<HTMLDivElement>;
  scrollerContentContainerRef: React.RefObject<HTMLDivElement>;
  inverted: boolean;
  /** This value must change when the scroll height of the scroller changes */
  scrollerContentsKey: Data;
  needsAnchoring: (
    prevKey: Data,
    nextKey: Data,
    /** Scroll offset of anchoring scroll element */
    scrollTop: number
  ) => boolean;
}) {
  // Since `Data` could be a nullable type, use an ad-hoc box type to track optionality
  const prevKey = React.useRef<[Data] | null>(null);

  const [queuedScrollAnchorPayload, setQueuedScrollAnchorPayload] =
    React.useState<{
      previousScrollHeight: number;
    } | null>(null);

  const scrollHeightRef = React.useRef<number | null>(null);

  const resizeObserver = React.useMemo(
    () =>
      new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === scrollerContentContainerRef.current) {
            scrollHeightRef.current = entry.contentRect.height;
          }
        }
      }),
    [scrollerContentContainerRef]
  );
  React.useLayoutEffect(
    () => resizeObserver.observe(scrollerContentContainerRef.current!),
    [resizeObserver, scrollerContentContainerRef]
  );

  React.useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (
      scrollHeightRef.current == null ||
      prevKey.current == null ||
      scroller == null
    ) {
      return;
    }
    const needsAnchor = checkNeedsAnchor(
      prevKey.current[0],
      scrollerContentsKey,
      scroller.scrollTop
    );
    if (!needsAnchor) {
      return;
    }
    setQueuedScrollAnchorPayload({
      previousScrollHeight: scrollHeightRef.current,
    });
  }, [checkNeedsAnchor, scrollerRef, scrollerContentsKey, inverted]);

  React.useLayoutEffect(() => {
    if (queuedScrollAnchorPayload == null) {
      return;
    }
    const scroller = scrollerRef.current;
    if (scroller == null) {
      return;
    }
    const scrollHeightChange =
      scroller.scrollHeight - queuedScrollAnchorPayload.previousScrollHeight;
    if (scrollHeightChange === 0) {
      return;
    }
    const scrollOffset = scroller.scrollTop + scrollHeightChange;
    scroller.scrollTo({ top: scrollOffset, behavior: 'instant' });
    setQueuedScrollAnchorPayload(null);
  }, [scrollerRef, queuedScrollAnchorPayload]);

  React.useEffect(() => {
    prevKey.current = [scrollerContentsKey];
  }, [scrollerContentsKey]);
}

function useStickToScrollStart({
  inverted,
  scrollerContentsKey,
  scrollerRef,
}: {
  inverted: boolean;
  /** This value must change when the scroll height of the scroller changes */
  scrollerContentsKey: unknown;

  scrollerRef: React.RefObject<HTMLDivElement>;
}): { setShouldStickToScrollStart: (shouldStick: boolean) => void } {
  const shouldStickToStartRef = React.useRef(false);

  React.useEffect(() => {
    if (!shouldStickToStartRef.current) {
      return;
    }
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    scroller.scrollTo({ top: inverted ? scroller.scrollHeight : 0 });
  }, [scrollerRef, scrollerContentsKey, inverted]);

  return {
    setShouldStickToScrollStart: React.useCallback((shouldStick: boolean) => {
      shouldStickToStartRef.current = shouldStick;
    }, []),
  };
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

function useBoundaryCallbacks({
  scrollerRef,
  scrollBoundaries,
  onTopReached,
  onBottomReached,
}: {
  scrollerRef: React.RefObject<HTMLElement | null>;
  scrollBoundaries: {
    isAtTop: boolean;
    isAtBottom: boolean;
  };
  onTopReached?: () => void;
  onBottomReached?: () => void;
}) {
  const lastInvocationScrollHeight = React.useRef<
    Partial<Record<'top' | 'bottom', number>>
  >({});
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    if (lastInvocationScrollHeight.current.top === scroller.scrollHeight) {
      return;
    }
    if (scrollBoundaries.isAtTop) {
      lastInvocationScrollHeight.current.top = scroller.scrollHeight;
      onTopReached?.();
    }
  }, [scrollBoundaries.isAtTop, onTopReached, scrollerRef]);
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    if (lastInvocationScrollHeight.current.bottom === scroller.scrollHeight) {
      return;
    }
    if (scrollBoundaries.isAtBottom) {
      lastInvocationScrollHeight.current.bottom = scroller.scrollHeight;
      onBottomReached?.();
    }
  }, [scrollBoundaries.isAtBottom, onBottomReached, scrollerRef]);
}

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
