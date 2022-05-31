import React, { useCallback } from 'react';
import { differenceInDays } from 'date-fns';
import { BigIntOrderedMap, daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import ChatWritScroller from './ChatWritScroller';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { useChatInfo } from '../useChatStore';
import ChatNotice from '../ChatNotice';
import { ChatState } from '../../state/chat/type';
import { useChatState } from '../../state/chat/chat';
import { MESSAGE_FETCH_PAGE_SIZE } from '../../constants';
import { ChatWrit } from '../../types/chat';

export default function ChatScroller(props: IChatScroller) {
  const { whom, messages, replying } = props;
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

  interface RendererProps {
    index: bigInt.BigInteger;
  }

  const renderer = React.forwardRef<HTMLDivElement, RendererProps>(
    ({ index }: RendererProps, ref) => {
      const writ = messages.get(index);

      const isNotice = writ ? 'notice' in writ.memo.content : false;
      if (isNotice) {
        return <ChatNotice key={writ.seal.id} writ={writ} />;
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

      return (
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

  const fetchMessages = useCallback(
    async (newer: boolean) => {
      if (newer) {
        return true;
      }

      return useChatState
        .getState()
        .fetchOlder(whom, MESSAGE_FETCH_PAGE_SIZE.toString());
    },
    [whom]
  );

  return (
    <div className="relative h-full flex-1">
      {messages.size > 0 ? (
        <ChatWritScroller
          key={whom}
          origin="bottom"
          style={{ height: '100%' }}
          data={mess}
          size={mess.size}
          pendingSize={0} // TODO
          averageHeight={48}
          renderer={renderer}
          loadRows={fetchMessages}
        />
      ) : null}
    </div>
  );
}
