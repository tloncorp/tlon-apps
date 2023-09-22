import cn from 'classnames';
import _ from 'lodash';
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
import { emptyQuip } from '@/types/channel';
import { IQuipScroller } from './IQuipScroller';
import QuipMessage, { QuipMessageProps } from '../ChatMessage/QuipMessage';
import { useChatStore } from '../useChatStore';

interface QuipScrollerItemProps extends QuipMessageProps {
  prefixedElement?: ReactNode;
}

const QuipScrollerItem = React.forwardRef<
  HTMLDivElement,
  QuipScrollerItemProps
>(({ quip, prefixedElement, ...props }, ref) => (
  <>
    {prefixedElement || null}
    <QuipMessage key={quip.cork.id} ref={ref} quip={quip} {...props} />
  </>
));

function itemContent(_i: number, entry: QuipScrollerItemProps) {
  return <QuipScrollerItem {...entry} />;
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
  item: QuipScrollerItemProps,
  context: any
) {
  return item.time.toString();
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

export default function QuipScroller({
  whom,
  messages,
  prefixedElement,
  scrollTo = undefined,
  scrollerRef,
}: IQuipScroller) {
  const isMobile = useIsMobile();
  const writWindow = useWritWindow(whom, scrollTo?.toString());
  const [fetching, setFetching] = useState<FetchingState>('initial');
  const [isScrolling, setIsScrolling] = useState(false);
  const firstPass = useRef(true);
  const isDMOrMultiDM = useIsDmOrMultiDm(whom);
  const { mutate: markChatRead } = useMarkReadMutation();

  const thresholds = {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: getTopThreshold(isMobile, messages.length),
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const [keys, entries]: [bigInt.BigInteger[], QuipScrollerItemProps[]] =
    useMemo(() => {
      const nonNullMessages = messages
        .toArray()
        .filter(([_k, v]) => v !== null);

      const ks: bigInt.BigInteger[] = nonNullMessages.map(([k]) => k);
      const min = nonNullMessages?.[0]?.[0] || bigInt();
      const es: QuipScrollerItemProps[] =
        nonNullMessages.map<QuipScrollerItemProps>(([index, quip]) => {
          if (!quip || !quip.memo || !quip.cork) {
            return {
              quip: emptyQuip,
              han: 'chat',
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

          console.log({
            quip,
            index,
          });
          const keyIdx = ks.findIndex((idx) => idx.eq(index));
          const lastQuipKey = keyIdx > 0 ? ks[keyIdx - 1] : undefined;
          const lastQuip = lastQuipKey
            ? nonNullMessages.find(([k]) => k.eq(lastQuipKey))?.[1]
            : undefined;
          const newAuthor = lastQuip
            ? quip.memo.author !== lastQuip.memo.author
            : true;
          const quipDay = new Date(daToUnix(index));
          const lastQuipDay = lastQuipKey
            ? new Date(daToUnix(lastQuipKey))
            : undefined;
          const newDay =
            lastQuip && lastQuipDay
              ? !isSameDay(quipDay, lastQuipDay)
              : !lastQuip;

          return {
            index,
            whom,
            quip,
            han: 'chat',
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
    }, [whom, scrollTo, messages, prefixedElement, isScrolling]);

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
