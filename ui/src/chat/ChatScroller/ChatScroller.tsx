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
import { useChatState, useLoadedWrits } from '@/state/chat/chat';
import { MESSAGE_FETCH_PAGE_SIZE } from '@/constants';
import { ChatBrief, ChatWrit } from '@/types/chat';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { ChatInfo, useChatInfo } from '../useChatStore';
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
  brief,
  chatInfo,
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
      const unreadBrief =
        brief && brief['read-id'] === writ.seal.id ? brief : undefined;

      return renderPrefix(
        index,
        <ChatMessage
          key={writ.seal.id}
          whom={whom}
          isReplyOp={chatInfo?.replying === writ.seal.id}
          writ={writ}
          time={index}
          newAuthor={newAuthor}
          newDay={newDay}
          ref={ref}
          unread={unreadBrief}
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
  const loaded = useLoadedWrits(whom);
  const [fetching, setFetching] = useState<FetchingState>('initial');
  const virtuoso = useRef<VirtuosoHandle>(null);

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
        brief,
        chatInfo,
        prefixedElement,
        scrollTo,
      }),
    [messages, whom, keys, brief, chatInfo, prefixedElement, scrollTo]
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
    async (newer: boolean) => {
      const newest = messages.peekLargest();
      const seenNewest = newer && newest && loaded.newest.geq(newest[0]);
      const oldest = messages.peekSmallest();
      const seenOldest = !newer && oldest && loaded.oldest.leq(oldest[0]);

      if (seenNewest || seenOldest) {
        return;
      }

      setFetching(newer ? 'bottom' : 'top');

      if (newer) {
        await useChatState
          .getState()
          .fetchNewer(whom, MESSAGE_FETCH_PAGE_SIZE.toString());
      } else {
        await useChatState
          .getState()
          .fetchOlder(whom, MESSAGE_FETCH_PAGE_SIZE.toString());
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
  const [firstItemIndex, setfirstItemIndex] = useState(START_INDEX);
  const [initialTopMostItemIndex, setInitialTopMostItemIndex] = useState(
    START_INDEX - 1
  );

  useEffect(() => {
    setfirstItemIndex(START_INDEX - keys.length);
  }, [keys]);

  useEffect(() => {
    if (keys.length === 0) {
      return;
    }

    const idx = scrollTo
      ? keys.findIndex((k) => k.eq(scrollTo))
      : keys.length - 1;

    if (idx === initialTopMostItemIndex) {
      return;
    }

    setInitialTopMostItemIndex(idx > -1 ? idx : START_INDEX - 1);
  }, [initialTopMostItemIndex, keys, scrollTo]);

  /**
   * If scrollTo is set, we want to scroll to that index.
   * If it's not set, we want to scroll to the bottom.
   */
  useEffect(() => {
    if (virtuoso.current) {
      let scrollToIndex: number | 'LAST';
      if (!scrollTo || !keys.length) {
        scrollToIndex = 'LAST';
      } else {
        const idx = keys.findIndex((k) => k.greaterOrEquals(scrollTo));
        scrollToIndex = idx > -1 ? idx : 'LAST';
      }

      setTimeout(() => {
        if (!virtuoso.current) {
          return;
        }
        virtuoso.current.scrollToIndex({
          index: scrollToIndex,
          align: 'start',
          behavior: 'auto',
        });
      }, 50);
    }
    /**
     * Only trigger this effect when scrollTo changes (e.g., clicking the unread
     * banner); otherwise, we'll scroll to the bottom each time older messages
     * are fetched.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

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
        atBottomThreshold={250}
        atTopThreshold={2500}
        overscan={{ main: 100, reverse: 100 }}
        atTopStateChange={(top) => {
          if (top) {
            fetchMessages(false);
          }
        }}
        atBottomStateChange={(bot) => {
          if (bot) {
            fetchMessages(true);
          }
        }}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={initialTopMostItemIndex}
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
