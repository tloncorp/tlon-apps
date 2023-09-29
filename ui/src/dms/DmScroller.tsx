import cn from 'classnames';
import React, {
  HTMLAttributes,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { isSameDay } from 'date-fns';
import { debounce } from 'lodash';
import { daToUnix } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { useIsMobile } from '@/logic/useMedia';
import { newReplyMap } from '@/types/channel';
import ChatMessage, { ChatMessageProps } from '@/chat/ChatMessage/ChatMessage';
import { useChatStore } from '@/chat/useChatStore';
import ChatNotice from '@/chat/ChatNotice';
import { Writ, WritMap } from '@/types/dms';
import { STANDARD_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { useChatState, useWritWindow } from '@/state/chat';

interface DmScrollerItemProps extends ChatMessageProps {
  index: BigInteger;
  prefixedElement?: ReactNode;
  writ: Writ;
}

const emptyWrit: Writ = {
  seal: {
    id: '',
    time: '',
    replies: newReplyMap(),
    feels: {},
    meta: {
      replyCount: 0,
      lastRepliers: [],
      lastReply: null,
    },
  },
  essay: {
    content: [],
    author: window.our,
    sent: Date.now(),
    'han-data': {
      chat: null,
    },
  },
};

const DmScrollerItem = React.forwardRef<HTMLDivElement, DmScrollerItemProps>(
  ({ index, writ = emptyWrit, prefixedElement, ...props }, ref) => {
    if (!writ) {
      return null;
    }

    const han = writ.essay['han-data'].chat;
    const isNotice = han && 'notice' in han;

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
        <ChatMessage key={writ.seal.id} ref={ref} writ={writ} {...props} />
      </>
    );
  }
);

function itemContent(_i: number, entry: DmScrollerItemProps) {
  return <DmScrollerItem {...entry} />;
}

function Loader({ show }: { show: boolean }) {
  return show ? (
    <div className="align-center flex h-8 w-full justify-center p-1">
      <LoadingSpinner primary="fill-gray-50" secondary="fill-white" />
    </div>
  ) : null;
}

type FetchingState = 'top' | 'bottom' | 'initial';

function computeItemKey(
  index: number,
  item: DmScrollerItemProps,
  context: any
) {
  return item.index.toString();
}

const List = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div {...props} className={cn('pr-4', props.className)} ref={ref} />
  )
);

function getTopThreshold(isMobile: boolean, msgCount: number) {
  if (msgCount >= 100) {
    return isMobile ? 1200 : 2500;
  }

  return window.innerHeight * 0.6;
}

function scrollToIndex(
  keys: BigInteger[],
  scrollerRef: React.RefObject<VirtuosoHandle>,
  scrollTo?: BigInteger
) {
  if (scrollerRef.current && scrollTo) {
    const index = keys.findIndex((k) => k.greaterOrEquals(scrollTo));
    scrollerRef.current.scrollToIndex({ index, align: 'center' });
  }
}

export interface DmScrollerProps {
  whom: string;
  messages: WritMap;
  replying?: boolean;
  prefixedElement?: ReactNode;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
}

export default function DmScroller({
  whom,
  messages,
  replying = false,
  prefixedElement,
  scrollTo = undefined,
  scrollerRef,
}: DmScrollerProps) {
  const isMobile = useIsMobile();
  const [fetching, setFetching] = useState<FetchingState>('initial');
  const [isScrolling, setIsScrolling] = useState(false);
  const firstPass = useRef(true);
  const writWindow = useWritWindow(whom);

  const thresholds = {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: getTopThreshold(isMobile, messages.length),
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const [keys, entries]: [BigInteger[], DmScrollerItemProps[]] = useMemo(() => {
    const ks: BigInteger[] = messages.keysArray();
    const min = messages.minKey() || bigInt.zero;
    const es: DmScrollerItemProps[] = messages
      .toArray()
      .map<DmScrollerItemProps>(([index, writ]) => {
        if (!writ) {
          return {
            index,
            writ: emptyWrit,
            hideReplies: replying,
            time: index,
            newAuthor: false,
            newDay: false,
            isLast: false,
            isLinked: false,
            isScrolling,
            prefixedElement: index.eq(min) ? prefixedElement : undefined,
            whom,
          };
        }

        const keyIdx = ks.findIndex((idx) => idx.eq(index));
        const lastWritKey = keyIdx > 0 ? ks[keyIdx - 1] : undefined;
        const lastWrit = lastWritKey ? messages.get(lastWritKey) : undefined;
        const han = writ.essay['han-data'];
        const newAuthor = lastWrit
          ? writ.essay.author !== lastWrit.essay.author ||
            !!('chat' in han && han.chat && 'notice' in han.chat)
          : true;
        const writDay = new Date(daToUnix(index));
        const lastWritDay = lastWritKey
          ? new Date(daToUnix(lastWritKey))
          : undefined;
        const newDay =
          lastWrit && lastWritDay
            ? !isSameDay(writDay, lastWritDay)
            : !lastWrit;

        return {
          index,
          whom,
          writ,
          hideReplies: replying,
          replyCount: writ.seal.meta.replyCount,
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
  }, [whom, scrollTo, messages, replying, prefixedElement, isScrolling]);

  const hasScrollTo = useMemo(() => {
    if (!scrollTo) {
      return true;
    }

    return keys.some((k) => k.eq(scrollTo));
  }, [scrollTo, keys]);

  const TopLoader = useMemo(
    () => <Loader show={fetching === 'top'} />,
    [fetching]
  );

  /**
   * For reverse infinite scroll of older messages:
   *
   * See: https://virtuoso.dev/prepend-items/
   *
   * The actual index value is arbitrary, just need to change directionally
   */
  const START_INDEX = 9999999;
  const firstItemIndex = useMemo(() => START_INDEX - keys.length, [keys]);

  const initialTopMostIndex = scrollTo ? undefined : START_INDEX - 1;

  useEffect(() => {
    if (hasScrollTo) {
      // if scrollTo changes, scroll to the new index
      scrollToIndex(keys, scrollerRef, scrollTo);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo?.toString(), hasScrollTo]);

  const updateScroll = useRef(
    debounce(
      (e: boolean) => {
        setIsScrolling(e);
      },
      300,
      { leading: true, trailing: true }
    )
  );

  /**
   * we want to know immediately if scrolling, otherwise debounce updates
   */
  const handleScroll = useCallback(
    (scrolling: boolean) => {
      if (firstPass.current) {
        return;
      }

      if (scrolling && !isScrolling) {
        setIsScrolling(true);
      } else {
        updateScroll.current(scrolling);
      }
    },
    [isScrolling]
  );

  const components = useMemo(
    () => ({
      Header: () => TopLoader,
      List,
    }),
    [TopLoader]
  );

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
        setFetching(newer ? 'bottom' : 'top');

        if (newer) {
          await useChatState
            .getState()
            .fetchMessages(
              whom,
              pageSize.toString(),
              'newer',
              scrollTo?.toString()
            );
        } else {
          await useChatState
            .getState()
            .fetchMessages(
              whom,
              pageSize.toString(),
              'older',
              scrollTo?.toString()
            );
        }

        setFetching('initial');
      } catch (e) {
        console.log(e);
        setFetching('initial');
      }
    },
    [whom, messages, scrollTo, writWindow]
  );

  // perf: define these outside of render
  const atTopStateChange = (top: boolean) => top && fetchMessages(false);
  const atBottomStateChange = (bot: boolean) => {
    const { bottom, delayedRead } = useChatStore.getState();
    if (bot) {
      fetchMessages(true);
      bottom(true);

      if (!firstPass.current) {
        delayedRead(whom, () => useChatState.getState().markDmRead(whom));
      }
    } else {
      bottom(false);
    }
  };
  const totalListHeightChanged = useRef(
    debounce(() => {
      if (firstPass.current && !scrollTo) {
        scrollerRef.current?.scrollToIndex({ index: 'LAST', align: 'end' });
      }

      firstPass.current = false;
    }, 200)
  );

  const scrollerProps = {
    ...thresholds,
    data: entries,
    components,
    itemContent,
    computeItemKey,
    firstItemIndex,
    atTopStateChange,
    atBottomStateChange,
    ref: scrollerRef,
    followOutput: true,
    alignToBottom: true,
    isScrolling: handleScroll,
    // DO NOT REMOVE
    // we do overflow-y: scroll here to prevent the scrollbar appearing and changing
    // size of elements, triggering a reflow loop in virtual scroller
    style: { overflowY: 'scroll' } as React.CSSProperties,
    className: 'h-full overflow-x-hidden p-4',
    totalListHeightChanged: totalListHeightChanged.current,
  };

  return (
    <div className="relative h-full flex-1">
      {initialTopMostIndex === undefined ? (
        <Virtuoso {...scrollerProps} />
      ) : (
        <Virtuoso
          {...scrollerProps}
          initialTopMostItemIndex={initialTopMostIndex}
        />
      )}
    </div>
  );
}
