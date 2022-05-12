import React from 'react';
import { Virtuoso } from 'react-virtuoso';
import { differenceInDays } from 'date-fns';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';

import { useMessagesForChat } from '../state/chat';
import ChatMessage, { ChatMessageProps } from './ChatMessage/ChatMessage';
import { useChat } from './useChatStore';

interface ChatMessagesProps
  extends Omit<ChatMessageProps, 'writ' | 'newAuthor' | 'newDay'> {
  flag: string;
  replying?: string;
}

export default function ChatMessages(props: ChatMessagesProps) {
  const { flag, replying = null, ...rest } = props;
  const messages = useMessagesForChat(flag);
  const chat = useChat(flag);

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
        {...rest}
        writ={writ}
        newAuthor={newAuthor}
        newDay={newDay}
      />
    );
  };

  return (
    <>
      {keys.map((key, index) => {
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
            {...rest}
            isReplyOp={chat?.replying === writ.seal.time}
            writ={writ}
            newAuthor={newAuthor}
            newDay={newDay}
          />
        );
      })}
    </>
  );
}
