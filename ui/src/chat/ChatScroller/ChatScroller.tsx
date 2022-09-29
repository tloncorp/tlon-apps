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
import ChatWritScroller from './ChatWritScroller';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { ChatInfo, useChatInfo } from '../useChatStore';
import ChatNotice from '../ChatNotice';
import { ChatState } from '../../state/chat/type';
import { useChatState } from '../../state/chat/chat';
import { MESSAGE_FETCH_PAGE_SIZE } from '../../constants';
import { ChatBrief, ChatWrit } from '../../types/chat';

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

const FIRST_INDEX = 99999;

export default function ChatScroller({
  whom,
  messages,
  replying = false,
  prefixedElement,
  scrollTo = undefined,
}: IChatScroller) {
  const chatInfo = useChatInfo(whom);
  const brief = useChatState((s: ChatState) => s.briefs[whom]);

  const keys = messages
    .keys()
    .reverse()
    .filter((k) => {
      if (replying) {
        return true;
      }
      return messages.get(k)?.memo.replying === null;
    });
  const mess = keys.reduce(
    (acc, val) => acc.set(val, messages.get(val)),
    new BigIntOrderedMap<ChatWrit>()
  );

  const [indexData, setIndexData] = useState<{
    firstItemIndex: number;
    totalCount: number;
  }>({
    firstItemIndex: FIRST_INDEX,
    totalCount: mess.size,
  });

  console.log(indexData);

  useEffect(() => {
    const diff = mess.size - indexData.totalCount;
    if (diff !== 0) {
      setIndexData({
        firstItemIndex: indexData.firstItemIndex - diff,
        totalCount: mess.size,
      });
    }
  }, [mess, indexData]);

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

  const fetchMessages = useCallback(
    async (newer: boolean) => {
      if (newer) {
        return useChatState
          .getState()
          .fetchNewer(whom, MESSAGE_FETCH_PAGE_SIZE.toString());
      }

      return useChatState
        .getState()
        .fetchOlder(whom, MESSAGE_FETCH_PAGE_SIZE.toString());
    },
    [whom]
  );

  return (
    <div className="relative h-full flex-1">
      <Virtuoso
        followOutput
        alignToBottom
        className="h-full"
        computeItemKey={(index) => keys[index]?.toString() || index}
        {...indexData}
        initialTopMostItemIndex={mess.size - 1}
        // we've memoized message so it should be stable
        // eslint-disable-next-line
        itemContent={(index) =>
          keys[index] ? (
            <Message index={keys[index]} />
          ) : (
            <div className="h-4" />
          )
        }
        atBottomThreshold={250}
        atTopThreshold={250}
        atTopStateChange={(top) => top && fetchMessages(false)}
        atBottomStateChange={(bot) => bot && fetchMessages(true)}
      />
    </div>
  );
}
