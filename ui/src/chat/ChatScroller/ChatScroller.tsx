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
import bigInt from 'big-integer';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import {
  useChatState,
  useIsDmOrMultiDm,
  useWritWindow,
} from '@/state/chat/chat';
import { STANDARD_MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { useIsMobile } from '@/logic/useMedia';
import { useMarkReadMutation } from '@/state/channel/channel';
import { IChatScroller } from './IChatScroller';
import ChatMessage, { ChatMessageProps } from '../ChatMessage/ChatMessage';
import { useChatStore } from '../useChatStore';
import ChatNotice from '../ChatNotice';
import { emptyNote } from '@/types/channel';

interface ChatScrollerItemProps extends ChatMessageProps {
  index: bigInt.BigInteger;
  prefixedElement?: ReactNode;
}

const ChatScrollerItem = React.forwardRef<
  HTMLDivElement,
  ChatScrollerItemProps
>(({ index, writ = emptyNote, prefixedElement, ...props }, ref) => {
  if (!writ) {
    return null;
  }

  if (
    !('chat' in writ.essay['han-data']) ||
    writ.essay['han-data'].chat === null
  ) {
    return null;
  }

  const isNotice = !!('notice' in writ.essay['han-data'].chat);

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
});

function itemContent(_i: number, entry: ChatScrollerItemProps) {
  return <ChatScrollerItem {...entry} />;
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
  item: ChatScrollerItemProps,
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
  keys: bigInt.BigInteger[],
  scrollerRef: React.RefObject<VirtuosoHandle>,
  scrollTo?: bigInt.BigInteger
) {
  if (scrollerRef.current && scrollTo) {
    const index = keys.findIndex((k) => k.greaterOrEquals(scrollTo));
    scrollerRef.current.scrollToIndex({ index, align: 'center' });
  }
}

export default function ChatScroller({
  whom,
  messages,
  replying = false,
  prefixedElement,
  scrollTo = undefined,
  scrollerRef,
}: IChatScroller) {
  const isMobile = useIsMobile();
  const writWindow = useWritWindow(whom, scrollTo);
  const [fetching, setFetching] = useState<FetchingState>('initial');
  const [isScrolling, setIsScrolling] = useState(false);
  const firstPass = useRef(true);
  const isDMOrMultiDM = useIsDmOrMultiDm(whom);
  const { mutate: markChatRead } = useMarkReadMutation();

  const thresholds = {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: getTopThreshold(isMobile, messages.size),
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const [keys, entries]: [bigInt.BigInteger[], ChatScrollerItemProps[]] =
    useMemo(() => {
      const messagesWithoutReplies = messages.filter((k) => {
        if (replying) {
          return true;
        }
        return messages.get(k)?.seal.quipCount === 0;
      });

      const ks: bigInt.BigInteger[] = Array.from(messagesWithoutReplies.keys());
      const min = messagesWithoutReplies.minKey() || bigInt();
      const es: ChatScrollerItemProps[] = messagesWithoutReplies
        .toArray()
        .map<ChatScrollerItemProps>(([index, writ]) => {
          if (!writ) {
            return {
              index,
              writ: emptyNote,
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
          const newAuthor = lastWrit
            ? writ.essay.author !== lastWrit.essay.author ||
              ('chat' in writ.essay['han-data'] &&
                !!writ.essay['han-data'].chat &&
                !!('notice' in writ.essay['han-data'].chat))
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
            .fetchMessages(whom, pageSize.toString(), 'newer', scrollTo);
        } else {
          await useChatState
            .getState()
            .fetchMessages(whom, pageSize.toString(), 'older', scrollTo);
        }

        setFetching('initial');
      } catch (e) {
        console.log(e);
        setFetching('initial');
      }
    },
    [whom, messages, scrollTo, writWindow]
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

  // perf: define these outside of render
  const atTopStateChange = (top: boolean) => top && fetchMessages(false);
  const atBottomStateChange = (bot: boolean) => {
    const { bottom, delayedRead } = useChatStore.getState();
    if (bot) {
      fetchMessages(true);
      bottom(true);

      if (!firstPass.current) {
        delayedRead(whom, () => {
          if (isDMOrMultiDM) {
            useChatState.getState().markDmRead(whom);
          } else {
            markChatRead({
              nest: `chat/${whom}`,
            });
          }
        });
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
