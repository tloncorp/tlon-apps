import React from 'react';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { differenceInDays } from 'date-fns';
import { rest } from 'lodash';
import { Virtuoso } from 'react-virtuoso';
import ChatMessage from '../../chat/ChatMessage/ChatMessage';
import { ChatScrollerProps } from './ChatScrollerProps';

export default function VirtuosoScroller(props: ChatScrollerProps) {
  const { chat, messages, replying } = props;

  const endReached = (index: number) => {
    // TODO: load more messages when at the end
    console.log(`end reached (${index}), load more ...`);
  };

  const keys = messages
    .keys()
    .reverse()
    .filter((k) => messages.get(k)!.memo.replying === replying);

  const itemContent = (index: number, key: bigInt.BigInteger) => {
    const writ = messages.get(key);
    const lastWrit = index > 0 ? messages.get(keys[index - 1]) : undefined;
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
        isReplyOp={writ.memo.replying === writ.seal.time}
        writ={writ}
        newAuthor={newAuthor}
        newDay={newDay}
        {...rest}
      />
    );
  };
  return (
    <>
      <Virtuoso
        className="h-full"
        data={keys}
        endReached={endReached}
        itemContent={itemContent}
        alignToBottom={replying ? false : true}
        followOutput={'auto'}
        computeItemKey={(_index, key) => key.toString()}
        overscan={3} // TODO: tune for optimal experience vs performance
      />
      ;
    </>
  );
}
