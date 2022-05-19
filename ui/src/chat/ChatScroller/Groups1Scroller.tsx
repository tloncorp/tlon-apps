import React from 'react';
import { differenceInDays } from 'date-fns';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';

import ChatWritScroller from './ChatWritScroller';
import { IChatScroller } from './IChatScroller';
import ChatMessage from '../ChatMessage/ChatMessage';
import { useChatInfo } from '../useChatStore';

export default function Groups1Scroller(props: IChatScroller) {
  const { whom, messages, replying, ...rest } = props;
  const chatInfo = useChatInfo(whom);

  const keys = messages
    .keys()
    .reverse()
    .filter((k) => {
      if (replying) {
        return true;
      }
      return messages.get(k)?.memo.replying === null;
    });
  
  interface RendererProps { index: bigInt.BigInteger }

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


      return (
        <ChatMessage
          key={writ.seal.id}
          {...rest}
          whom={whom}
          isReplyOp={chatInfo?.replying === writ.seal.id}
          writ={writ}
          time={index}
          newAuthor={newAuthor}
          newDay={newDay}
          ref={ref}
        />
      );
    }
  );

  const onTopLoaded = () => {
    // TODO
    // const { graphSize, unreadCount } = this.props;
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

  const fetchMessages = async (newer: boolean) => {
    console.log(`fetch newer messages: ${newer} ...`);
    return true;
  };

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
