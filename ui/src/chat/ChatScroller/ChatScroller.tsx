import React, { useCallback } from 'react';
import { differenceInDays } from 'date-fns';
import { daToUnix, decToUd, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import ChatWritScroller from './ChatWritScroller';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { useChatInfo } from '../useChatStore';
import ChatNotice from '../ChatNotice';
import { ChatState } from '../../state/chat/type';
import { useChatState } from '../../state/chat/chat';
import { MESSAGE_FETCH_PAGE_SIZE } from '../../constants';

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
        ? writ.memo.author !== lastWrit.memo.author
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

  const onTopLoaded = () => {
    // TODO
    // const { messagesSize, unreadCount } = this.props;
    // if(graphSize >= unreadCount) {
    //   this.props.dismissUnread();
    // }
    console.log('on top...');
  };

  const onBottomLoaded = () => {
    // TODO
    // if(this.state.unreadIndex.eq(bigInt.zero)) {
    //   this.calculateUnreadIndex();
    // }
    console.log('on bottom...');
  };

  const fetchMessages = useCallback(
    async (newer: boolean) => {
      if (newer) {
        return false;
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
          origin="top"
          onBottomLoaded={onBottomLoaded}
          onTopLoaded={onTopLoaded}
          data={messages}
          size={messages.size}
          pendingSize={0} // TODO
          averageHeight={48}
          renderer={renderer}
          loadRows={fetchMessages}
        />
      ) : null}
    </div>
  );
}
