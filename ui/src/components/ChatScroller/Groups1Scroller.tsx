import React, { useEffect } from 'react';
import { differenceInDays } from 'date-fns';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';

import ChatMessage from '../ChatMessage/ChatMessage';
import ChatWritScroller from '../VirtualScroller/ChatWritScroller';
import { ChatScrollerProps } from './ChatScrollerProps';


export default function Groups1Scroller(props: ChatScrollerProps) {
  const { messages, replying, ...rest } = props;

  const keys = messages
    .keys()
    .reverse()
    .filter((k) => messages.get(k)!.memo.replying === replying);

  const renderer = React.forwardRef(({ index }: { index: bigInt.BigInteger }, ref) => {
    const writ = messages.get(index);
    const graphIdx = keys.findIndex(idx => idx.eq(index));
    const prevIdx = keys[graphIdx - 1];

    const lastWrit = prevIdx ? messages.get(prevIdx) : undefined;
    const newAuthor = lastWrit
      ? writ.memo.author !== lastWrit.memo.author
      : true;
    const writDay = new Date(daToUnix(bigInt(udToDec(writ.seal.time))));
    const lastWritDay = lastWrit
      ? new Date(daToUnix(bigInt(udToDec(lastWrit.seal.time))))
      : undefined;
    const newDay =
      lastWrit && lastWritDay
        ? differenceInDays(writDay, lastWritDay) > 0
        : false;

    return (
      <ChatMessage
        key={writ.seal.time}
        {...rest}
        writ={writ}
        newAuthor={newAuthor}
        newDay={newDay}
        ref={ref}
      />
    );
  });


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

  useEffect(() => {
    console.log(`messages: ${messages.size}`);
  }, [messages]);

  return (
    <div className="h-full flex-1">
      {
        messages.size > 0 ?
          <ChatWritScroller
            offset={0} // TODO: unreadCount
            origin='bottom'
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
          : null
      }
    </div>
  );
}
