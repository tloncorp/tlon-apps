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
  const [oldWhom, setOldWhom] = useState(whom);
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
    if (whom !== oldWhom) {
      setOldWhom(whom);
    }
  }, [oldWhom, whom]);

  useEffect(() => {
    if (oldWhom !== whom) {
      setIndexData({ firstItemIndex: FIRST_INDEX, data: keys });
      return;
    }

    const diff = mess.size - indexData.data.length;
    if (diff !== 0) {
      setIndexData({
        firstItemIndex: indexData.firstItemIndex - diff,
        data: keys,
      });
    }

    // Sometimes the virtuoso component doesn't scroll to the bottom when
    // switching chats. Diff remains zero when it shouldn't.
    // This is a hack to force it to scroll to the bottom.

    if (indexData.firstItemIndex === FIRST_INDEX && diff === 0) {
      // We need to wait to make sure the virtuoso component has been updated.
      setTimeout(() => {
        virtuoso?.current?.scrollToIndex({
          index: indexData.data.length - 1,
        });
      }, 50);
    }
  }, [whom, oldWhom, keys, mess, indexData]);

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
      const newest = mess.peekLargest();
      const seenNewest = newer && newest && loaded.newest.leq(newest[0]);
      const oldest = mess.peekSmallest();
      const seenOldest = !newer && oldest && loaded.oldest.geq(oldest[0]);

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
    [whom, mess, loaded]
  );

  return (
    <div className="relative h-full flex-1">
      <Virtuoso
        {...indexData}
        ref={virtuoso}
        followOutput
        alignToBottom
        className="h-full overflow-x-hidden p-4"
        atBottomThreshold={250}
        atTopThreshold={250}
        atTopStateChange={(top) => top && fetchMessages(false)}
        atBottomStateChange={(bot) => bot && fetchMessages(true)}
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
