import cn from 'classnames';
import React, {
  HTMLAttributes,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isSameDay } from 'date-fns';
import { BigIntOrderedMap, daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { Virtuoso } from 'react-virtuoso';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { ChatState } from '@/state/chat/type';
import {
  useChatState,
  useGetFirstUnreadID,
  useLoadedWrits,
} from '@/state/chat/chat';
import {
  INITIAL_MESSAGE_FETCH_PAGE_SIZE,
  STANDARD_MESSAGE_FETCH_PAGE_SIZE,
} from '@/constants';
import { ChatBrief, ChatWrit } from '@/types/chat';
import { useIsMobile } from '@/logic/useMedia';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { ChatInfo, useChatStore } from '../useChatStore';
import ChatNotice from '../ChatNotice';

interface CreateRendererParams {
  messages: BigIntOrderedMap<ChatWrit>;
  keys: bigInt.BigInteger[];
  replying: boolean;
  whom: string;
  brief?: ChatBrief;
  chatInfo?: ChatInfo;
  prefixedElement: React.ReactNode;
  scrollTo?: bigInt.BigInteger;
  isScrolling: boolean;
}

interface RendererProps {
  index: bigInt.BigInteger;
}

function createRenderer({
  messages,
  keys,
  whom,
  replying,
  prefixedElement,
  scrollTo,
  isScrolling,
}: CreateRendererParams) {
  const renderPrefix = (index: bigInt.BigInteger, child: ReactNode) => (
    <>
      {index.eq(messages.peekSmallest()[0]) ? prefixedElement : null}
      {child}
    </>
  );

  return React.forwardRef<HTMLDivElement, RendererProps>(
    ({ index }: RendererProps, ref) => {
      const writ = messages.get(index);

      if (!writ) {
        return null;
      }

      const keyIdx = keys.findIndex((idx) => idx.eq(index));
      const lastWritKey = keyIdx > 0 ? keys[keyIdx - 1] : undefined;
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

      const isNotice = writ ? 'notice' in writ.memo.content : false;
      if (isNotice) {
        return renderPrefix(
          index,
          <ChatNotice key={writ.seal.id} writ={writ} newDay={writDay} />
        );
      }

      return renderPrefix(
        index,
        <ChatMessage
          key={writ.seal.id}
          whom={whom}
          writ={writ}
          hideReplies={replying}
          time={index}
          newAuthor={newAuthor}
          newDay={newDay}
          ref={ref}
          isLast={keyIdx === keys.length - 1}
          isLinked={scrollTo ? index.eq(scrollTo) : false}
          isScrolling={isScrolling}
        />
      );
    }
  );
}

function Loader({ show }: { show: boolean }) {
  return show ? (
    <div className="align-center flex h-8 w-full justify-center p-1">
      <LoadingSpinner primary="fill-gray-50" secondary="fill-white" />
    </div>
  ) : null;
}

type FetchingState = 'top' | 'bottom' | 'initial';

function computeItemKey(index: number, item: bigInt.BigInteger, context: any) {
  return item.toString();
}

const List = React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div {...props} className={cn('pr-4', props.className)} ref={ref} />
  )
);

export default function ChatScroller({
  whom,
  messages,
  replying = false,
  prefixedElement,
  scrollTo = undefined,
  scrollerRef,
}: IChatScroller) {
  const brief = useChatState((s: ChatState) => s.briefs[whom]);
  const firstUnreadID = useGetFirstUnreadID(whom);
  const loaded = useLoadedWrits(whom);
  const [fetching, setFetching] = useState<FetchingState>('initial');
  const isMobile = useIsMobile();
  const [isScrolling, setIsScrolling] = useState(false);
  const { atBottom } = useChatStore.getState();
  const [height, setHeight] = useState(0);

  const thresholds = {
    atBottomThreshold: isMobile ? 125 : 250,
    atTopThreshold: isMobile ? 1200 : 2500,
    overscan: isMobile
      ? { main: 200, reverse: 200 }
      : { main: 400, reverse: 400 },
  };

  const keys = useMemo(
    () =>
      messages
        .keys()
        .reverse()
        .filter((k) => {
          if (replying) {
            return true;
          }
          return messages.get(k)?.memo.replying === null;
        }),
    [messages, replying]
  );

  const Message = useMemo(
    () =>
      createRenderer({
        messages,
        whom,
        replying,
        keys,
        prefixedElement,
        scrollTo,
        isScrolling,
      }),
    [messages, whom, keys, replying, prefixedElement, scrollTo, isScrolling]
  );

  const TopLoader = useMemo(
    () => <Loader show={fetching === 'top'} />,
    [fetching]
  );
  const BottomLoader = useMemo(
    () => <Loader show={fetching === 'bottom'} />,
    [fetching]
  );

  const fetchMessages = useCallback(
    async (newer: boolean, pageSize = STANDARD_MESSAGE_FETCH_PAGE_SIZE) => {
      const newest = messages.peekLargest();
      const seenNewest = newer && newest && loaded.newest.geq(newest[0]);
      const oldest = messages.peekSmallest();
      const seenOldest = !newer && oldest && loaded.oldest.leq(oldest[0]);

      if (seenNewest || seenOldest) {
        return;
      }

      try {
        setFetching(newer ? 'bottom' : 'top');

        if (newer) {
          await useChatState.getState().fetchNewer(whom, pageSize.toString());
        } else {
          await useChatState.getState().fetchOlder(whom, pageSize.toString());
        }

        setFetching('initial');
      } catch (e) {
        console.log(e);
        setFetching('initial');
      }
    },
    [whom, messages, loaded]
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
  /**
   * If scrollTo is set, we want to set initial scroll to that index.
   * If it's not set, we want to set initial scroll to the bottom.
   */
  const initialTopMostIndex = useMemo(() => {
    const scrollToIdx = scrollTo
      ? keys.findIndex((k) => k.greaterOrEquals(scrollTo))
      : -1;

    return scrollToIdx > -1 ? scrollToIdx : START_INDEX - 1;
  }, [keys, scrollTo]);

  /**
   * By default, 50 messages are fetched on initial load. If there are more
   * unreads per the brief, fetch those as well. That way, the user can click
   * the unread banner and see the unread messages.
   */
  useEffect(() => {
    if (
      fetching === 'initial' &&
      brief &&
      brief.count > INITIAL_MESSAGE_FETCH_PAGE_SIZE &&
      firstUnreadID &&
      !keys.includes(firstUnreadID)
    ) {
      fetchMessages(false, brief.count);
    }
    /**
     * Only want to track the brief and unread ID
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief, firstUnreadID]);

  const handleScroll = useCallback(
    (e: boolean) => {
      if (e !== isScrolling && !atBottom) {
        setIsScrolling(e);
      }
    },
    [isScrolling, atBottom]
  );

  const components = useMemo(
    () => ({
      Header: () => TopLoader,
      Footer: () => BottomLoader,
      List,
    }),
    [BottomLoader, TopLoader]
  );

  if (keys.length === 0) {
    return null;
  }

  // perf: define these outside of render
  const atTopStateChange = (top: boolean) => top && fetchMessages(false);
  const atBottomStateChange = (bot: boolean) => {
    const { bottom, delayedRead } = useChatStore.getState();
    if (bot) {
      fetchMessages(true);
      bottom(true);
      delayedRead(whom, () => useChatState.getState().markRead(whom));
    } else {
      bottom(false);
    }
  };
  const totalListHeightChanged = (newHeight: number) => {
    if (height < newHeight && atBottom) {
      scrollerRef.current?.scrollBy({ left: 0, top: newHeight - height });
      setHeight(newHeight);
    }
  };
  const handleIsScrolling = (e: boolean) => {
    handleScroll(e);
  };

  const itemContent = (i: number, realIndex: bigInt.BigInteger) => (
    <Message index={realIndex} />
  );

  return (
    <div className="relative h-full flex-1">
      <Virtuoso
        data={keys}
        ref={scrollerRef}
        followOutput
        alignToBottom
        isScrolling={handleIsScrolling}
        className="h-full overflow-x-hidden p-4"
        {...thresholds}
        atTopStateChange={atTopStateChange}
        atBottomStateChange={atBottomStateChange}
        totalListHeightChanged={totalListHeightChanged}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={initialTopMostIndex}
        itemContent={itemContent}
        computeItemKey={computeItemKey}
        components={components}
      />
    </div>
  );
}
