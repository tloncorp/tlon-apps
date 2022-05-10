import React from 'react';
import { BigIntOrderedMap, daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { ChatWhom, ChatWrit } from '../types/chat';
import { differenceInDays } from 'date-fns';
import ChatMessage from './ChatMessage/ChatMessage';

export default function ChatMessages(props: {
  messages: BigIntOrderedMap<ChatWrit>;
  whom: ChatWhom;
}) {
  const { messages, whom } = props;
  return (
    <>
      {messages
        .keys()
        .reverse()
        .map((key, index) => {
          const writ = messages.get(key);
          const lastWrit =
            index > 0
              ? messages.get(messages.keys().reverse()[index - 1])
              : undefined;
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
              whom={whom}
              writ={writ}
              newAuthor={newAuthor}
              newDay={newDay}
            />
          );
        })}
    </>
  );
}
