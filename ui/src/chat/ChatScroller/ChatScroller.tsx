import { Virtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { daToUnix } from '@urbit/api';
import React, {
  PropsWithChildren,
  ReactElement,
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
import { BigInteger } from 'big-integer';
import BTree from 'sorted-btree';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import {
  useUserHasScrolled,
  useInvertedScrollInteraction,
} from '@/logic/scroll';
import { useIsMobile } from '@/logic/useMedia';
import {
  ChatMessageListItemData,
  useMessageData,
} from '@/logic/useScrollerMessages';
import { createDevLogger, useObjectChangeLogging } from '@/logic/utils';
import EmptyPlaceholder from '@/components/EmptyPlaceholder';
import { ChatWrit } from '@/types/chat';
import { useChatState } from '@/state/chat';
import ChatMessage from '../ChatMessage/ChatMessage';
import ChatNotice from '../ChatNotice';
import { useChatStore } from '../useChatStore';

const logger = createDevLogger('ChatScroller', false);

interface CustomScrollItemData {
  type: 'custom';
  key: string;
  component: ReactElement;
}

const ChatScrollerItem = React.memo(
  ({
    item,
    isScrolling,
  }: {
    item: ChatMessageListItemData | CustomScrollItemData;
    isScrolling: boolean;
  }) => {
    if (item.type === 'custom') {
      return item.component;
    }

    const { writ, time } = item;
    const content = writ?.memo?.content ?? {};
    if ('notice' in content) {
      return (
        <ChatNotice
          key={writ.seal.id}
          writ={writ}
          newDay={new Date(daToUnix(time))}
        />
      );
    }

    return (
      <ChatMessage key={writ.seal.id} isScrolling={isScrolling} {...item} />
    );
  }
);

function Loader({
  className,
  scaleY,
  children,
}: PropsWithChildren<{ className?: string; scaleY: number }>) {
  return (
    <div
      className={`absolute flex w-full justify-start text-base ${className}`}
      style={{ transform: `scaleY(${scaleY})` }}
    >
      <div className="m-4 flex items-center gap-3 rounded-lg text-gray-500">
        <div className="flex h-6 w-6 items-center justify-center">
          <LoadingSpinner primary="fill-gray-900" secondary="fill-gray-200" />
        </div>

        {children}
      </div>
    </div>
  );
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
  overscan: 6,
};

const loaderPadding = {
  top: 40,
  bottom: 0,
};

export interface ChatScrollerProps {
  whom: string;
  messages: BTree<BigInteger, ChatWrit>;
  replying?: boolean;
  /**
   * Element to be inserted at the top of the list scroll after we've loaded the
   * entire history.
   */
  topLoadEndMarker?: ReactElement;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
  scrollElementRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
}

export default function ChatScroller({
  whom,
  messages,
  replying = false,
  topLoadEndMarker,
  scrollTo: rawScrollTo = undefined,
  scrollerRef,
  scrollElementRef,
  isScrolling,
}: ChatScrollerProps) {
  const isMobile = useIsMobile();
  const scrollTo = useBigInt(rawScrollTo);
  const [loadDirection, setLoadDirection] = useState<'newer' | 'older'>(
    'older'
  );
  const [isAtBottom, setIsAtBottom] = useState(loadDirection === 'older');
  const [isAtTop, setIsAtTop] = useState(false);
  const contentElementRef = useRef<HTMLDivElement>(null);
  const { userHasScrolled, resetUserHasScrolled } =
    useUserHasScrolled(scrollElementRef);

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
  });

  useObjectChangeLogging(
    { hasLoadedNewest, hasLoadedOldest, isAtTop, isAtBottom },
    logger
  );

  const topItem: CustomScrollItemData | null = useMemo(
    () =>
      topLoadEndMarker && hasLoadedOldest
        ? {
            type: 'custom',
            key: 'top-marker',
            component: topLoadEndMarker,
          }
        : null,
    [topLoadEndMarker, hasLoadedOldest]
  );

  const [messageKeys, messageEntries] = useMemo(() => {
    const nextMessageKeys = [
      ...(topItem ? [topItem.key] : []),
      ...activeMessageKeys,
    ];
    const nextMessageEntries = [
      ...(topItem ? [topItem] : []),
      ...activeMessageEntries,
    ];
    return [nextMessageKeys, nextMessageEntries];
  }, [activeMessageKeys, activeMessageEntries, topItem]);

  const count = messageKeys.length;

  const anchorIndex = useMemo(() => {
    if (count === 0) {
      return null;
    }
    if (scrollTo) {
      const index = messageKeys.findIndex(
        (k) => !(typeof k === 'string') && k.greaterOrEquals(scrollTo)
      );
      return index === -1 ? null : index;
    }
    return count - 1;
  }, [messageKeys, count, scrollTo]);

  const virtualizerRef = useRef<DivVirtualizer>();

  /**
   * Set scroll position, bypassing virtualizer change logic.
   */
  const forceScroll = useCallback((offset: number) => {
    const virt = virtualizerRef.current;
    if (!virt) return;
    virt.scrollOffset = offset;
    virt.scrollElement?.scrollTo?.({ top: offset });
  }, []);

  const isEmpty = count === 0 && hasLoadedNewest && hasLoadedOldest;
  const contentHeight = virtualizerRef.current?.getTotalSize() ?? 0;
  const scrollElementHeight = scrollElementRef.current?.clientHeight ?? 0;
  const isScrollable = contentHeight > scrollElementHeight;
  const isInverted = isEmpty
    ? false
    : !isScrollable
    ? true
    : loadDirection === 'older';
  // We want to render newest messages first, but we receive them oldest-first.
  // This is a simple way to reverse the order without having to reverse a big array.
  const transformIndex = useCallback(
    (index: number) => (isInverted ? count - 1 - index : index),
    [count, isInverted]
  );

  /**
   * Scroll to current anchor index
   */
  const scrollToAnchor = useCallback(() => {
    logger.log('scrolling to anchor');
    const virt = virtualizerRef.current;
    if (!virt || anchorIndex === null) return;
    const index = transformIndex(anchorIndex);
    const [nextOffset] = virt.getOffsetForIndex(index, 'center');
    const measurement = virt.measurementsCache[index];
    // If the anchor index is 0 (the newest message) we want to stay locked all
    // the way to the bottom
    // TODO: This looks a little off visually since the author of the message isn't highlighted.
    const sizeAdjustment = index === 0 ? 0 : (measurement?.size ?? 0) / 2;
    forceScroll(nextOffset + sizeAdjustment);
  }, [anchorIndex, forceScroll, transformIndex]);

  // Reset scroll when scrollTo changes
  useEffect(() => {
    logger.log('scrollto changed');
    resetUserHasScrolled();
    scrollToAnchor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  const isLoadingAtStart = fetchState === (isInverted ? 'bottom' : 'top');
  const isLoadingAtEnd = fetchState === (isInverted ? 'top' : 'bottom');
  const paddingStart = isLoadingAtStart
    ? isInverted
      ? loaderPadding.bottom
      : loaderPadding.top
    : 0;
  const paddingEnd = isLoadingAtEnd
    ? isInverted
      ? loaderPadding.top
      : loaderPadding.bottom
    : 0;

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: useCallback(
      () => scrollElementRef.current,
      [scrollElementRef]
    ),
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
      (index: number) => messageKeys[transformIndex(index)].toString(),
      [messageKeys, transformIndex]
    ),
    paddingStart,
    paddingEnd,
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
        if (anchorIndex !== null && !userHasScrolled) {
          // Fix for no-param-reassign
          scrollToAnchor();
        } else {
          instance.scrollElement?.scrollTo?.({
            top: offset + (adjustments ?? 0),
            behavior,
          });
        }
      },
      [isScrolling, isMobile, anchorIndex, userHasScrolled, scrollToAnchor]
    ),
    overscan: thresholds.overscan,
    // Called by the virtualizer whenever any layout property changes.
    // We're using it to keep track of top and bottom thresholds.
    onChange: useCallback(() => {
      if (anchorIndex !== null && !userHasScrolled) {
        scrollToAnchor();
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
    }, [
      isInverted,
      anchorIndex,
      userHasScrolled,
      scrollToAnchor,
      scrollElementRef,
    ]),
  });
  virtualizerRef.current = virtualizer;

  useFakeVirtuosoHandle(scrollerRef, virtualizer);
  useInvertedScrollInteraction(scrollElementRef, isInverted);

  // Load more content if there's not enough to fill the scroller + there's more to load.
  // The main place this happens is when there are a bunch of replies in the recent chat history.
  const contentIsShort = contentHeight < scrollElementHeight;
  useEffect(() => {
    if (
      contentIsShort &&
      fetchState === 'initial' &&
      // don't try to load more in threads, because their content is already fetched by main window
      !replying
    ) {
      const loadingNewer = loadDirection === 'newer';
      if (
        (loadingNewer && !hasLoadedNewest) ||
        (!loadingNewer && !hasLoadedOldest)
      ) {
        logger.log('not enough content, loading more');
        fetchMessages(loadingNewer);
      }
    }
  }, [
    replying,
    contentIsShort,
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
      logger.log('loading older messages');
      setLoadDirection('older');
      chatStore.bottom(false);
      fetchMessages(false);
    } else if (isAtBottom && !hasLoadedNewest) {
      logger.log('loading newer messages');
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
    logger.log('inverting chat scroller');
    forceScroll(contentHeight - virtualizer.scrollOffset);
    lastIsInverted.current = isInverted;
  }

  const scaleY = isInverted ? -1 : 1;
  const virtualItems = virtualizer.getVirtualItems();
  // On first run, virtualizerRef will be empty, so contentHeight will be undefined.
  // TODO: Distentangle virtualizer init to avoid this.
  const finalHeight = contentHeight ?? virtualizer.getTotalSize();

  return (
    <div
      ref={scrollElementRef}
      className="h-full w-full overflow-y-auto overflow-x-clip overscroll-contain"
      style={{ transform: `scaleY(${scaleY})` }}
      // We need this in order to get key events on the div, which we use remap
      // arrow and spacebar navigation when scrolling.
      // TODO: This now gets outlined when scrolling with keys. Should it?
      tabIndex={-1}
    >
      {hasLoadedNewest && hasLoadedOldest && count === 0 && (
        <EmptyPlaceholder>
          There are no messages in this channel
        </EmptyPlaceholder>
      )}
      <div
        className="l-0 absolute top-0 w-full"
        ref={contentElementRef}
        style={{
          height: `${finalHeight}px`,
          paddingTop: virtualItems[0]?.start ?? 0,
          pointerEvents: isScrolling ? 'none' : 'all',
        }}
      >
        {isLoadingAtStart && !isInverted && (
          <Loader className="top-0" scaleY={scaleY}>
            Loading {isInverted ? 'Newer' : 'Older'}
          </Loader>
        )}
        {virtualItems.map((virtualItem) => {
          const item = messageEntries[transformIndex(virtualItem.index)];
          return (
            <div
              key={virtualItem.key}
              className="relative w-full px-4 sm:hover:z-10"
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                transform: `scaleY(${scaleY})`,
              }}
            >
              <ChatScrollerItem item={item} isScrolling={isScrolling} />
            </div>
          );
        })}
        {isLoadingAtEnd && isInverted && (
          <Loader className="bottom-0" scaleY={scaleY}>
            Loading {isInverted ? 'Older' : 'Newer'}
          </Loader>
        )}
      </div>
    </div>
  );
}
