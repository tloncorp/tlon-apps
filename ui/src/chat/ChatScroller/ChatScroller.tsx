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
import { BigIntOrderedMap, daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { ChatState } from '@/state/chat/type';
import {
  useChatState,
  useGetFirstUnreadID,
  useLoadedWrits,
} from '@/state/chat/chat';
import { MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { ChatBrief, ChatWrit } from '@/types/chat';
import { useIsMobile } from '@/logic/useMedia';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { ChatInfo, useChatInfo, useChatStore } from '../useChatStore';
import ChatNotice from '../ChatNotice';

interface CreateRendererParams {
  messages: BigIntOrderedMap<ChatWrit>;
  keys: bigInt.BigInteger[];
  whom: string;
  brief?: ChatBrief;
  chatInfo?: ChatInfo;
  prefixedElement: React.ReactNode;
  scrollTo?: bigInt.BigInteger;
}

interface RendererProps {
  index: bigInt.BigInteger;
}

function createRenderer({
  messages,
  keys,
  whom,
  prefixedElement,
  scrollTo,
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

      const isNotice = writ ? 'notice' in writ.memo.content : false;
      if (isNotice) {
        return renderPrefix(
          index,
          <ChatNotice key={writ.seal.id} writ={writ} />
        );
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

      return renderPrefix(
        index,
        <ChatMessage
          key={writ.seal.id}
          whom={whom}
          writ={writ}
          time={index}
          newAuthor={newAuthor}
          newDay={newDay}
          ref={ref}
          isLast={keyIdx === keys.length - 1}
          isLinked={scrollTo ? index.eq(scrollTo) : false}
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
}: IChatScroller) {
  const chatInfo = useChatInfo(whom);
  const brief = useChatState((s: ChatState) => s.briefs[whom]);
  const firstUnreadID = useGetFirstUnreadID(whom);
  const loaded = useLoadedWrits(whom);
  const [fetching, setFetching] = useState<FetchingState>('initial');
  const virtuoso = useRef<VirtuosoHandle>(null);
  const isMobile = useIsMobile();

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
        keys,
        prefixedElement,
        scrollTo,
      }),
    [messages, whom, keys, prefixedElement, scrollTo]
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
    async (newer: boolean, pageSize = MESSAGE_FETCH_PAGE_SIZE) => {
      const newest = messages.peekLargest();
      const seenNewest = newer && newest && loaded.newest.geq(newest[0]);
      const oldest = messages.peekSmallest();
      const seenOldest = !newer && oldest && loaded.oldest.leq(oldest[0]);

      if (seenNewest || seenOldest) {
        return;
      }

      setFetching(newer ? 'bottom' : 'top');

      if (newer) {
        await useChatState.getState().fetchNewer(whom, pageSize.toString());
      } else {
        await useChatState.getState().fetchOlder(whom, pageSize.toString());
      }

      setFetching('initial');
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
   * If scrollTo is set, we want to scroll to that index.
   * If it's not set, we want to scroll to the bottom.
   */
  useEffect(() => {
    if (virtuoso.current) {
      let scrollToIndex: number | 'LAST' = 'LAST';
      if (scrollTo) {
        const idx = keys.findIndex((k) => k.greaterOrEquals(scrollTo));
        scrollToIndex = idx > -1 ? idx : 'LAST';
      }

      virtuoso.current.scrollToIndex({
        index: scrollToIndex,
        align: 'start',
        behavior: 'auto',
      });
    }
    /**
     * Only trigger this effect when scrollTo changes (e.g., clicking the unread
     * banner); otherwise, we'll scroll to the bottom each time older messages
     * are fetched, or jump to the scrollTo message if it's in the backscroll
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo, virtuoso]);

  /**
   * By default, 100 messages are fetched on initial load. If there are more
   * unreads per the brief, fetch those as well. That way, the user can click
   * the unread banner and see the unread messages.
   */
  useEffect(() => {
    if (
      fetching === 'initial' &&
      brief &&
      brief.count > MESSAGE_FETCH_PAGE_SIZE &&
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

  return (
    <div className="relative h-full flex-1">
      <Virtuoso
        data={keys}
        ref={virtuoso}
        followOutput
        alignToBottom
        className="h-full overflow-x-hidden p-4"
        // we do overflow-y: scroll here to prevent the scrollbar appearing and changing
        // size of elements, triggering a reflow loop in virtual scroller
        style={{
          overflowY: 'scroll',
        }}
        {...thresholds}
        atTopStateChange={(top) => top && fetchMessages(false)}
        atBottomStateChange={(bot) => {
          const { bottom, delayedRead } = useChatStore.getState();
          if (bot) {
            fetchMessages(true);
            bottom(true);
            delayedRead(whom, () => useChatState.getState().markRead(whom));
          } else {
            bottom(false);
          }
        }}
        firstItemIndex={firstItemIndex}
        itemContent={(i, realIndex) => <Message index={realIndex} />}
        computeItemKey={computeItemKey}
        components={{
          Header: () => TopLoader,
          Footer: () => BottomLoader,
          List,
        }}
      />
    </div>
  );
}
