import { Virtualizer, useVirtualizer } from '@tanstack/react-virtual';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { isSameDay } from 'date-fns';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  FlatIndexLocationWithAlign,
  FlatScrollIntoViewLocation,
  VirtuosoHandle,
} from 'react-virtuoso';
import BTree from 'sorted-btree';

import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { STANDARD_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { useIsMobile } from '@/logic/useMedia';
import { useChatState, useWritWindow } from '@/state/chat/chat';
import { ChatWrit } from '@/types/chat';
import ChatMessage, { ChatMessageProps } from '../ChatMessage/ChatMessage';
import ChatNotice from '../ChatNotice';
import { useChatStore } from '../useChatStore';
import { IChatScroller } from './IChatScroller';

type ChatWritTree = BTree<bigInt.BigInteger, ChatWrit>;

interface ChatScrollerItemProps extends ChatMessageProps {
  index: bigInt.BigInteger;
  prefixedElement?: ReactNode;
}

const ChatScrollerItem = React.memo(
  ({ index, writ, prefixedElement, ...props }: ChatScrollerItemProps, ref) => {
    const isNotice = writ ? 'notice' in writ.memo.content : false;
    if (isNotice) {
      return (
        <>
          {prefixedElement || null}
          <ChatNotice
            key={writ.seal.id}
            writ={writ}
            newDay={new Date(daToUnix(index))}
          />
        </>
      );
    }

    return (
      <>
        {prefixedElement || null}
        <ChatMessage key={writ.seal.id} writ={writ} {...props} />
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

function getTopThreshold(isMobile: boolean, messageCount: number) {
  if (messageCount >= 100) {
    return isMobile ? 1200 : 2500;
  }

  return window.innerHeight * 0.6;
}

function getThresholds(isMobile: boolean, messageCount: number) {
  return {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: getTopThreshold(isMobile, messageCount),
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };
}

function getMessageItems({
  whom,
  scrollTo,
  messages,
  replying,
  prefixedElement,
  isScrolling,
}: {
  whom: string;
  scrollTo?: bigInt.BigInteger;
  messages: ChatWritTree;
  replying: boolean;
  prefixedElement: React.ReactNode;
  isScrolling: boolean;
}): [bigInt.BigInteger[], ChatScrollerItemProps[]] {
  const messagesWithoutReplies = messages.filter((k) => {
    if (replying) {
      return true;
    }
    return messages.get(k)?.memo.replying === null;
  });

  const ks: bigInt.BigInteger[] = Array.from(messagesWithoutReplies.keys());
  const min = messagesWithoutReplies.minKey() || bigInt();
  const es: ChatScrollerItemProps[] = messagesWithoutReplies
    .toArray()
    .map<ChatScrollerItemProps>(([index, writ]) => {
      const keyIdx = ks.findIndex((idx) => idx.eq(index));
      const lastWritKey = keyIdx > 0 ? ks[keyIdx - 1] : undefined;
      const lastWrit = lastWritKey ? messages.get(lastWritKey) : undefined;
      const newAuthor = lastWrit
        ? writ.memo.author !== lastWrit.memo.author ||
          'notice' in lastWrit.memo.content
        : true;
      const writDay = new Date(daToUnix(index));
      const lastWritDay = lastWritKey
        ? new Date(daToUnix(lastWritKey))
        : undefined;
      const newDay =
        lastWrit && lastWritDay ? !isSameDay(writDay, lastWritDay) : !lastWrit;

      return {
        index,
        whom,
        writ,
        hideReplies: replying,
        time: index,
        newAuthor,
        newDay,
        isLast: keyIdx === ks.length - 1,
        isLinked: scrollTo ? index.eq(scrollTo) : false,
        isScrolling,
        prefixedElement: index.eq(min) ? prefixedElement : undefined,
      };
    });

  return [ks, es];
}

type FetchingState = 'top' | 'bottom' | 'initial';

function useFetchMessages({
  whom,
  messages,
  scrollTo,
}: {
  whom: string;
  messages: ChatWritTree;
  scrollTo?: bigInt.BigInteger;
}) {
  const writWindow = useWritWindow(whom, scrollTo);
  const [fetchState, setFetchState] = useState<FetchingState>('initial');

  const fetchMessages = useCallback(
    async (newer: boolean, pageSize = STANDARD_MESSAGE_FETCH_PAGE_SIZE) => {
      const newest = messages.maxKey();
      const seenNewest =
        newer && newest && writWindow && writWindow.loadedNewest;
      const oldest = messages.minKey();
      const seenOldest =
        !newer && oldest && writWindow && writWindow.loadedOldest;

      if (seenNewest || seenOldest) {
        return;
      }

      try {
        setFetchState(newer ? 'bottom' : 'top');

        if (newer) {
          await useChatState
            .getState()
            .fetchMessages(whom, pageSize.toString(), 'newer', scrollTo);
        } else {
          await useChatState
            .getState()
            .fetchMessages(whom, pageSize.toString(), 'older', scrollTo);
        }

        setFetchState('initial');
      } catch (e) {
        console.log(e);
        setFetchState('initial');
      }
    },
    [whom, messages, scrollTo, writWindow]
  );
  return useMemo(
    () => ({ fetchMessages, fetchState }),
    [fetchMessages, fetchState]
  );
}

const useIsScrolling = (
  options: {
    checkInterval: number;
    scrollStopDelay: number;
  } = {
    checkInterval: 200,
    scrollStopDelay: 200,
  }
) => {
  const { checkInterval, scrollStopDelay } = options;
  const [isScrolling, setIsScrolling] = useState(false);
  const lastScrollTime = useRef(0);

  // This performs a bit better than setting and clearing a million
  // setTimeouts, even debounced, but in the worst case takes 2 * checkInterval
  useEffect(() => {
    if (!isScrolling) return undefined;

    const interval = setInterval(() => {
      const delta = Date.now() - lastScrollTime.current;
      setIsScrolling(delta < scrollStopDelay);
    }, checkInterval);

    return () => clearInterval(interval);
  }, [isScrolling, checkInterval, scrollStopDelay]);

  const didScroll = useCallback(() => {
    lastScrollTime.current = Date.now();
    setIsScrolling(true);
  }, []);

  return { isScrolling, didScroll };
};

function useFakeVirtuosoHandle(
  ref: React.RefObject<VirtuosoHandle>,
  virtualizer: DivVirtualizer
) {
  const virtualizerRef = useRef<DivVirtualizer>(virtualizer);
  useEffect(() => {
    virtualizerRef.current = virtualizer;
  }, [virtualizer]);

  useImperativeHandle(
    ref,
    () =>
      ({
        /**
         * Scrolls the component to the specified item index. See {@link IndexLocationWithAlign} for more options.
         */
        scrollToIndex(location: number | FlatIndexLocationWithAlign): void {
          const hasOptions = !(typeof location === 'number');
          if (hasOptions) {
            const { index: rawIndex, align, behavior } = location;
            const index = rawIndex === 'LAST' ? 0 : rawIndex;
            virtualizerRef.current?.scrollToIndex(index, { align, behavior });
          } else {
            virtualizerRef.current?.scrollToIndex(location);
          }
        },
        /**
         * Scrolls the item into view if necessary. See [the website example](http://virtuoso.dev/keyboard-navigation/) for an implementation.
         */
        scrollIntoView({
          index,
          align,
          behavior,
          done,
        }: FlatScrollIntoViewLocation): void {
          virtualizerRef.current.scrollToIndex(index, { align, behavior });
          if (done) setTimeout(done, 500);
        },
      } as VirtuosoHandle),
    []
  );
}

type DivVirtualizer = Virtualizer<HTMLDivElement, HTMLDivElement>;
type DivVirtualizerOptions = DivVirtualizer['options'];

export default function ChatScroller({
  whom,
  messages,
  replying = false,
  prefixedElement,
  scrollTo = undefined,
  scrollerRef,
}: IChatScroller) {
  const isMobile = useIsMobile();
  const thresholds = getThresholds(isMobile, messages.size);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isAtTop, setIsAtTop] = useState(false);
  const { isScrolling, didScroll } = useIsScrolling();
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const isFirstPass = useRef(true);
  // TODO: Not sure whether this behavior is correct, or whether it's necessary
  // in the new scroller.
  useLayoutEffect(() => {
    isFirstPass.current = false;
  }, []);

  const [keys, entries] = useMemo(
    () =>
      getMessageItems({
        whom,
        scrollTo,
        messages,
        replying,
        prefixedElement,
        isScrolling,
      }),
    [whom, scrollTo, messages, replying, prefixedElement, isScrolling]
  );

  const { fetchMessages, fetchState } = useFetchMessages({
    whom,
    messages,
    scrollTo,
  });

  // We want to render newest messages first, but we receive them oldest-first.
  // This is a simple way to reverse the order without having to reverse a big array.
  // Mainly used when actually rendering virtualizer items.
  const count = entries.length;
  const reverseIndex = React.useCallback(
    (index: number) => count - 1 - index,
    [count]
  );

  // Used by the virtualizer to apply scroll position changes to the DOM.
  const scrollToFn: DivVirtualizerOptions['scrollToFn'] = useCallback(
    (offset, { adjustments, behavior }, instance) => {
      const target = offset + (adjustments ?? 0);
      if (!isScrolling) {
        instance.scrollElement?.scrollTo({ top: target, behavior });
      }
    },
    [isScrolling]
  );

  // Used by the virtualizer to keep track of scroll position. Note that the is
  // the *only* place the virtualizer accesses scroll position, so we can change
  // the virtualizer's idea of world state by modifying it.
  const observeElementOffset = useCallback(
    (instance: DivVirtualizer, cb: (offset: number) => void) => {
      const el = instance.scrollElement;
      if (!el) {
        return undefined;
      }
      const onScroll = () => {
        didScroll();
        cb(el.scrollTop);
      };
      cb(el.scrollTop);
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => el.removeEventListener('scroll', onScroll);
    },
    [didScroll]
  );

  // Called by the virtualizer whenever any layout property changes.
  // We're using it to keep track of top and bottom thresholds.
  const handleVirtualizerUpdate = useCallback(
    (v: DivVirtualizer) => {
      const { clientHeight, scrollTop, scrollHeight } =
        scrollElementRef.current ?? {
          clientHeight: 0,
          scrollTop: 0,
          scrollHeight: 0,
        };
      // Note that these checks are inverted because we're using `scaleY(-1)`
      // to flip the list
      const atTop =
        scrollTop + clientHeight > scrollHeight - thresholds.atTopThreshold;
      setIsAtTop(atTop);
      const atBottom = v.scrollOffset < thresholds.atBottomThreshold;
      setIsAtBottom(atBottom);
    },
    [thresholds.atBottomThreshold, thresholds.atTopThreshold]
  );

  // The virtualizer uses this to estimate items' sizes before they're rendered.
  // Determines where to place items initially, and how long the scroll content
  // is going to be overall. The better the estimate is, the less reflow will be
  // required after rendering.

  // TODO: This is a comically bad estimate. Making this a little better will
  // further reduce jank / reflow necessity.
  const estimateSize = useCallback((index: number) => 55, []);

  const virtualizer = useVirtualizer({
    count: entries.length,
    paddingEnd: 10,
    getScrollElement: useCallback(() => scrollElementRef.current, []),
    observeElementOffset,
    estimateSize,
    scrollToFn,
    onChange: handleVirtualizerUpdate,
  });
  useFakeVirtuosoHandle(scrollerRef, virtualizer);

  const hasScrollTo = useMemo(() => {
    if (!scrollTo) {
      return true;
    }
    return keys.some((k) => k.eq(scrollTo));
  }, [scrollTo, keys]);

  useEffect(() => {
    if (hasScrollTo && scrollTo && scrollerRef.current) {
      const index = keys.findIndex((k) => k.greaterOrEquals(scrollTo));
      scrollerRef.current?.scrollToIndex({
        index: reverseIndex(index),
        align: 'center',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo?.toString(), hasScrollTo, scrollerRef]);

  // Fetch older messages when we reach the top.
  useEffect(() => {
    if (isAtTop) fetchMessages(false);
    // Should *only* trigger if `isAtTop` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAtTop]);

  // Fetch newer messages when we reach the bottom.
  useEffect(() => {
    const { bottom: setAtBottom, delayedRead } = useChatStore.getState();
    if (isAtBottom) {
      fetchMessages(true);
      setAtBottom(true);
      if (!isFirstPass.current) {
        delayedRead(whom, () => useChatState.getState().markRead(whom));
      }
    } else {
      setAtBottom(false);
    }
    // Should *only* trigger if `isAtBottom` changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAtBottom]);

  // Invert mousewheel scroll so that it works properly on the inverted list. 
  // We need to use `useEffect` here because we're prevent default, which we can't
  // do inside passive event listeners, which React uses in prop events by default.
  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return undefined;
    const invertedWheelScroll = (e: WheelEvent) => {
      el.scrollTop -= e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', invertedWheelScroll, false);
    return () => el.removeEventListener('wheel', invertedWheelScroll);
  }, []);

  return (
    <div
      ref={scrollElementRef}
      className="h-full overflow-auto overflow-x-hidden"
      style={{ transform: 'scaleY(-1)' }}
    >
      <div
        className="relative w-full"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          pointerEvents: isScrolling ? 'none' : 'all',
        }}
      >
        {/* This loader ends up at the bottom after inversion */}
        <div className="absolute bottom-0 w-full">
          <Loader show={fetchState === 'top'} />
        </div>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = entries[reverseIndex(virtualItem.index)];
          return (
            <div
              key={virtualItem.key}
              className="t-0 l-0 absolute w-full px-4"
              // TODO: This will re-measure on every render, may want to
              // debounce or otherwise optimize.
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                transform: `translateY(${virtualItem.start}px) scaleY(-1)`,
              }}
            >
              <ChatScrollerItem {...item} />
            </div>
          );
        })}
        {/* This loader ends up at the top after inversion */}
        <div className="absolute top-0 w-full">
          <Loader show={fetchState === 'bottom'} />
        </div>
      </div>
    </div>
  );
}
