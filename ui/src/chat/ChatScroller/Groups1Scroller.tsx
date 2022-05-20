import React, { useCallback } from 'react';
import { differenceInDays } from 'date-fns';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';

import ChatWritScroller from './ChatWritScroller';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { useChatInfo } from '../useChatStore';
import ChatNotice from '../ChatNotice';
import { ChatState } from '../../state/chat/type';
import { useChatState, useCurrentPactSize } from '../../state/chat/chat';
import { IS_MOCK } from '../../api';
import { MESSAGE_FETCH_PAGE_SIZE } from '../../constants';

export default function Groups1Scroller(props: IChatScroller) {
  const { whom, messages, replying } = props;
  const chatInfo = useChatInfo(whom);
  const brief = useChatState((s: ChatState) => s.briefs[whom]);
  const currentMessagesSize = useCurrentPactSize(whom) ?? 0;

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
      const isNotice = 'notice' in writ.memo.content;
      if (isNotice) {
        return <ChatNotice key={writ.seal.id} writ={writ} />;
      }

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
          unread={
            brief && brief['read-id'] === writ.seal.id ? brief : undefined
          }
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
      if (IS_MOCK) {
        console.log(
          `[mock] fetching ${newer ? 'newer' : 'older'} messages ...`
        );
        return true;
      }

      const pageSize = MESSAGE_FETCH_PAGE_SIZE;
      const messagesSize = messages.size ?? 0;
      const expectedSize = messagesSize + pageSize;
      if (messagesSize === 0) {
        // already loading the graph
        return false;
      }

      if (newer) {
        // For now, the backend only supports querying for older messages
        // TODO: update this when fetchNewer API is implemented
        return expectedSize !== currentMessagesSize;
      }

      // else, older
      const index = messages.peekSmallest()?.[0];
      if (!index) {
        return false;
      }

      // await getOlderSiblings(ship, name, pageSize, `/${index.toString()}`);

      await useChatState.getState().fetchOlder(
        window.ship,
        newer
          ? messages.peekLargest()[0].toString()
          : messages.peekSmallest()[0].toString(),
        pageSize.toString() // TODO: tune the number of newer / older messages for which to query
      );

      const done = expectedSize !== currentMessagesSize;
      return done;
    },
    [currentMessagesSize, messages]
  );

  return (
    <div className="h-full flex-1">
      {messages.size > 0 ? (
        <ChatWritScroller
          origin="bottom"
          style={{ height: '100%' }}
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
