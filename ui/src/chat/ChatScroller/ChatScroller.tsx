import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { differenceInDays } from 'date-fns';
import { BigIntOrderedMap, daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { Virtuoso } from 'react-virtuoso';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import { ChatState } from '@/state/chat/type';
import { useChatState } from '@/state/chat/chat';
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
        lastWrit && lastWritDay
          ? differenceInDays(writDay, lastWritDay) > 0
          : false;
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

const FIRST_INDEX = 99999;

type FetchingState = 'top' | 'bottom' | 'initial';

function computeItemKey(index: number, item: bigInt.BigInteger, context: any) {
  return item.toString();
}

export default function ChatScroller({
  whom,
  messages,
  replying = false,
  prefixedElement,
  scrollTo = undefined,
}: IChatScroller) {
  const chatInfo = useChatInfo(whom);
  const brief = useChatState((s: ChatState) => s.briefs[whom]);
  const [fetching, setFetching] = useState<FetchingState>('initial');

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

  const mess = useMemo(
    () =>
      keys.reduce(
        (acc, val) => acc.set(val, messages.get(val)),
        new BigIntOrderedMap<ChatWrit>()
      ),
    [keys, messages]
  );

  const [indexData, setIndexData] = useState<{
    firstItemIndex: number;
    data: bigInt.BigInteger[];
  }>({
    firstItemIndex: FIRST_INDEX,
    data: keys,
  });

  useEffect(() => {
    const diff = mess.size - indexData.data.length;
    // console.log(JSON.stringify(keys), JSON.stringify(mess), indexData, diff);
    if (diff !== 0) {
      setIndexData({
        firstItemIndex: indexData.firstItemIndex - diff,
        data: keys,
      });
    }
  }, [keys, mess, indexData]);

  const Message = useMemo(
    () =>
      createRenderer({
        messages,
        whom,
        keys,
        brief,
        chatInfo,
        prefixedElement,
      }),
    [messages, keys, whom, brief, chatInfo, prefixedElement]
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
    [whom]
  );

  return (
    <div className="relative h-full flex-1 p-2">
      <Virtuoso
        {...indexData}
        followOutput
        alignToBottom
        className="h-full"
        atBottomThreshold={250}
        atTopThreshold={250}
        atTopStateChange={(top) => top && fetchMessages(false)}
        atBottomStateChange={(bot) => bot && fetchMessages(true)}
        itemContent={(i, realIndex) =>
          realIndex ? <Message index={realIndex} /> : <div className="h-4" />
        }
        computeItemKey={computeItemKey}
        components={{
          Header: () => TopLoader,
          Footer: () => BottomLoader,
        }}
      />
    </div>
  );
}
