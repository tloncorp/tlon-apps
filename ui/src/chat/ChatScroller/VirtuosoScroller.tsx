import React from 'react';
import { daToUnix } from '@urbit/api';
import bigInt from 'big-integer';
import { differenceInDays } from 'date-fns';
import { Virtuoso } from 'react-virtuoso';
import ChatMessage from '../ChatMessage/ChatMessage';
import { IChatScroller } from './IChatScroller';
import { useChatInfo } from '../useChatStore';
import ChatNotice from '../ChatNotice';

export default function VirtuosoScroller(props: IChatScroller) {
  const { whom, messages, replying, ...rest } = props;
  const chatInfo = useChatInfo(whom);

  const endReached = (index: number) => {
    // TODO: load more messages when at the end
    console.log(`end reached (${index}), load more ...`);
  };

  const keys = messages
    .keys()
    .reverse()
    .filter((k) => {
      if (replying) {
        return true;
      }
      return messages.get(k)?.memo.replying === null;
    });

  const itemContent = (index: number, key: bigInt.BigInteger) => {
    const writ = messages.get(key);
    const lastWritKey = index > 0 ? keys[index - 1] : undefined;
    const lastWrit = lastWritKey ? messages.get(lastWritKey) : undefined;
    const newAuthor = lastWrit
      ? writ.memo.author !== lastWrit.memo.author
      : true;
    const writDay = new Date(daToUnix(key));

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
        {...rest}
        whom={whom}
        isReplyOp={chatInfo?.replying === writ.seal.id}
        writ={writ}
        time={key}
        newAuthor={newAuthor}
        newDay={newDay}
      />
    );
  };

  return (
    <Virtuoso
      className="h-full"
      data={keys}
      endReached={endReached}
      itemContent={itemContent}
      alignToBottom={replying ? false : true}
      followOutput={'auto'}
      computeItemKey={(_index: number, key: bigInt.BigInteger) =>
        key.toString()
      }
      overscan={3} // TODO: tune for optimal experience vs performance
    />
  );
}
