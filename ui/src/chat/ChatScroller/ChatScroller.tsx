import { Virtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { daToUnix } from '@urbit/api';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatIndexLocationWithAlign,
  FlatScrollIntoViewLocation,
  VirtuosoHandle,
} from 'react-virtuoso';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import {
  useUserHasScrolled,
  useInvertedScrollInteraction,
  useIsScrolling,
} from '@/logic/scroll';
import { useIsMobile } from '@/logic/useMedia';
import { ScrollerItemData, useMessageData } from '@/logic/useScrollerMessages';
import { useChatState } from '@/state/chat/chat';
import { BigInteger } from 'big-integer';
import ChatMessage from '../ChatMessage/ChatMessage';
import ChatNotice from '../ChatNotice';
import { useChatStore } from '../useChatStore';
import { IChatScroller } from './IChatScroller';

const ChatScrollerItem = React.memo(
  ({ time, writ, prefixedElement, ...props }: ScrollerItemData) => {
    const isNotice = writ ? 'notice' in writ.memo.content : false;
    return (
      <>
        {prefixedElement || null}
        {isNotice ? (
          <ChatNotice
            key={writ.seal.id}
            writ={writ}
            newDay={new Date(daToUnix(time))}
          />
        ) : (
          <ChatMessage key={writ.seal.id} writ={writ} time={time} {...props} />
        )}
      </>
    );
  }
);

function Loader({ show }: { show: boolean }) {
  return show ? (
    <div className="align-center flex h-8 w-full justify-center p-1">
      <LoadingSpinner primary="fill-gray-50" secondary="fill-white" />
    </div>
  ) : null;
}

function useBigInt(value?: BigInteger) {
  const lastValueRef = useRef(value);
  return useMemo(() => {
    const last = lastValueRef.current;
    if (last !== value && last && value && last.eq(value)) {
      return last;
    }
    lastValueRef.current = value;
    return value;
  }, [value]);
}

function useFakeVirtuosoHandle(
  ref: React.RefObject<VirtuosoHandle>,
  virtualizer: DivVirtualizer
) {
  useImperativeHandle(
    ref,
    () =>
      ({
        scrollToIndex(location: number | FlatIndexLocationWithAlign): void {
          const hasOptions = !(typeof location === 'number');
          if (hasOptions) {
            const { index: rawIndex, align, behavior } = location;
            const index = rawIndex === 'LAST' ? 0 : rawIndex;
            virtualizer.scrollToIndex(index, { align, behavior });
          } else {
            virtualizer.scrollToIndex(location);
          }
        },
        scrollIntoView({
          index,
          align,
          behavior,
          done,
        }: FlatScrollIntoViewLocation): void {
          virtualizer.scrollToIndex(index, { align, behavior });
          if (done) setTimeout(done, 500);
        },
      } as VirtuosoHandle),
    [virtualizer]
  );
}

type DivVirtualizer = Virtualizer<HTMLDivElement, HTMLDivElement>;

const thresholds = {
  atEndThreshold: 2000,
  overscan: 12,
};

export default function ChatScroller({
  whom,
  messages,
  replying = false,
  prefixedElement,
  scrollTo: rawScrollTo = undefined,
  scrollerRef,
}: IChatScroller) {
  const isMobile = useIsMobile();
  const scrollTo = useBigInt(rawScrollTo);
  const [loadDirection, setLoadDirection] = useState<'newer' | 'older'>(
    'older'
  );
  const [isAtBottom, setIsAtBottom] = useState(loadDirection === 'older');
  const [isAtTop, setIsAtTop] = useState(false);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const contentElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const { userHasScrolled, resetUserHasScrolled } =
    useUserHasScrolled(scrollElementRef);
  const isInverted = loadDirection === 'older';

  const {
    activeMessageKeys,
    activeMessageEntries,
    fetchMessages,
    fetchState,
    hasLoadedNewest,
    hasLoadedOldest,
  } = useMessageData({
    whom,
    scrollTo,
    messages,
    replying,
    prefixedElement,
  });

  const count = activeMessageEntries.length;
  // We want to render newest messages first, but we receive them oldest-first.
  // This is a simple way to reverse the order without having to reverse a big array.
  const transformIndex = useCallback(
    (index: number) => (isInverted ? count - 1 - index : index),
    [count, isInverted]
  );

  const anchorIndex = useMemo(() => {
    if (count === 0) {
      return null;
    }
    if (scrollTo) {
      const index = activeMessageKeys.findIndex((k) =>
        k.greaterOrEquals(scrollTo)
      );
      return index === -1 ? null : index;
    }
    return count - 1;
  }, [activeMessageKeys, count, scrollTo]);

  const virtualizerRef = useRef<DivVirtualizer>();

  /**
   * Set scroll position, bypassing virtualizer change logic.
   */
  const forceScroll = useCallback((offset: number) => {
    const virt = virtualizerRef.current;
    if (!virt) return;
    virt.scrollOffset = offset;
    virt.scrollElement?.scrollTo({ top: offset });
  }, []);

  const triggerAnchorScroll = useCallback(() => {
    virtualizerRef.current?.scrollToOffset(0);
    requestAnimationFrame(() => virtualizerRef.current?.scrollToOffset(0));
  }, []);

  useEffect(() => {
    resetUserHasScrolled();
    triggerAnchorScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  const virtualizer = useVirtualizer({
    count: activeMessageEntries.length,
    getScrollElement: useCallback(() => scrollElementRef.current, []),
    // Used by the virtualizer to keep track of scroll position. Note that the is
    // the *only* place the virtualizer accesses scroll position, so we can change
    // the virtualizer's idea of world state by modifying it.
    observeElementOffset: useCallback(
      (instance: DivVirtualizer, cb: (offset: number) => void) => {
        const el = instance.scrollElement;
        if (!el) {
          return undefined;
        }
        const onScroll = () => {
          cb(el.scrollTop);
        };
        cb(el.scrollTop);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
      },
      []
    ),
    // The virtualizer uses this to estimate items' sizes before they're rendered.
    // Determines where to place items initially, and how long the scroll content
    // is going to be overall. The better the estimate is, the less reflow will be
    // required after rendering.
    // TODO: This is a comically bad estimate. Making this a little better will
    // further reduce jank / reflow necessity.
    estimateSize: useCallback((index: number) => 100, []),
    getItemKey: useCallback(
      (index: number) => activeMessageKeys[transformIndex(index)].toString(),
      [activeMessageKeys, transformIndex]
    ),
    scrollToFn: useCallback(
      (
        offset: number,
        {
          adjustments,
          behavior,
        }: { adjustments?: number; behavior?: ScrollBehavior },
        instance: DivVirtualizer
      ) => {
        // On iOS, changing scroll during momentum scrolling will cause stutters
        if (isMobile && isScrolling && userHasScrolled) {
          return;
        }
        // By default, the virtualizer tries to keep the position of the topmost
        // item on screen pinned, but we need to override that behavior to keep a
        // message centered or to stay at the bottom of the chat.
        if (anchorIndex !== null) {
          // Fix for no-param-reassign
          const virt = instance;
          const index = transformIndex(anchorIndex);
          const [nextOffset] = virt.getOffsetForIndex(index, 'center');
          const measurement = virt.measurementsCache[index];
          const sizeAdjustment = index === 0 ? 0 : (measurement?.size ?? 0) / 2;
          forceScroll(nextOffset + sizeAdjustment);
        } else {
          instance.scrollElement?.scrollTo({
            top: offset + (adjustments ?? 0),
            behavior,
          });
        }
      },
      [
        isScrolling,
        isMobile,
        anchorIndex,
        transformIndex,
        userHasScrolled,
        forceScroll,
      ]
    ),
    overscan: thresholds.overscan,
    // Called by the virtualizer whenever any layout property changes.
    // We're using it to keep track of top and bottom thresholds.
    onChange: useCallback(() => {
      if (anchorIndex !== null && !userHasScrolled) {
        triggerAnchorScroll();
      }
      const { clientHeight, scrollTop, scrollHeight } =
        scrollElementRef.current ?? {
          clientHeight: 0,
          scrollTop: 0,
          scrollHeight: 0,
        };
      // Prevent list from being at the end of new messages and old messages
      // at the same time -- can happen if there are few messages loaded.
      const atEndThreshold = Math.min(
        (scrollHeight - clientHeight) / 2,
        thresholds.atEndThreshold
      );
      const isAtBeginning = scrollTop === 0;
      const isAtEnd = scrollTop + clientHeight >= scrollHeight - atEndThreshold;
      setIsAtTop((isInverted && isAtEnd) || (!isInverted && isAtBeginning));
      setIsAtBottom((isInverted && isAtBeginning) || (!isInverted && isAtEnd));
    }, [isInverted, anchorIndex, userHasScrolled, triggerAnchorScroll]),
  });
  virtualizerRef.current = virtualizer;

  useFakeVirtuosoHandle(scrollerRef, virtualizer);
  useInvertedScrollInteraction(scrollElementRef, isInverted);

  // Load more content if there's not enough to fill the scroller + there's more to load.
  // The main place this happens is when there are a bunch of replies in the recent chat history.
  const contentHeight = virtualizer.getTotalSize();
  useEffect(() => {
    if (
      contentHeight < window.innerHeight &&
      fetchState === 'initial' &&
      // don't try to load more in threads, because their content is already fetched by main window
      !replying
    ) {
      const loadingNewer = loadDirection === 'newer';
      if (
        (loadingNewer && !hasLoadedNewest) ||
        (!loadingNewer && !hasLoadedOldest)
      ) {
        fetchMessages(loadingNewer);
      }
    }
  }, [
    replying,
    contentHeight,
    fetchMessages,
    fetchState,
    loadDirection,
    hasLoadedNewest,
    hasLoadedOldest,
  ]);

  // Load more items when list reaches the top or bottom.
  useEffect(() => {
    if (fetchState !== 'initial' || !userHasScrolled) return;
    const chatStore = useChatStore.getState();
    if (isAtTop && !hasLoadedOldest) {
      setLoadDirection('older');
      chatStore.bottom(false);
      fetchMessages(false);
    } else if (isAtBottom && !hasLoadedNewest) {
      setLoadDirection('newer');
      fetchMessages(true);
      chatStore.bottom(true);
      chatStore.delayedRead(whom, () => useChatState.getState().markRead(whom));
    }
  }, [
    fetchState,
    isAtTop,
    isAtBottom,
    fetchMessages,
    whom,
    hasLoadedOldest,
    hasLoadedNewest,
    userHasScrolled,
  ]);

  // When the list inverts, we need to flip the scroll position in order to appear to stay in the same place.
  // We do this here as opposed to in an effect so that virtualItems is correct in time for this render.
  const lastIsInverted = useRef(isInverted);
  if (userHasScrolled && isInverted !== lastIsInverted.current) {
    forceScroll(contentHeight - virtualizer.scrollOffset);
    lastIsInverted.current = isInverted;
  }

  const scaleY = isInverted ? -1 : 1;
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollElementRef}
      className="h-full overflow-y-auto overflow-x-clip"
      style={{ transform: `scaleY(${scaleY})` }}
      // We need this in order to get key events on the div, which we use remap
      // arrow and spacebar navigation when scrolling.
      // TODO: This now gets outlined when scrolling with keys. Should it?
      tabIndex={-1}
    >
      <div
        className="relative w-full"
        ref={contentElementRef}
        style={{
          height: `${contentHeight}px`,
          paddingTop: virtualItems[0].start,
          pointerEvents: isScrolling ? 'none' : 'all',
        }}
      >
        <div className="absolute top-0 w-full">
          <Loader show={fetchState === (isInverted ? 'bottom' : 'top')} />
        </div>

        {virtualItems.map((virtualItem) => {
          const item = activeMessageEntries[transformIndex(virtualItem.index)];
          return (
            <div
              key={virtualItem.key}
              className="px-4"
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                transform: `scaleY(${scaleY})`,
              }}
            >
              <ChatScrollerItem {...item} isScrolling={isScrolling} />
            </div>
          );
        })}
        <div className="absolute bottom-0 w-full">
          <Loader show={fetchState === (isInverted ? 'top' : 'bottom')} />
        </div>
      </div>
    </div>
  );
}
