import React from 'react';
import { BigIntOrderedMap, daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { differenceInDays } from 'date-fns';
import { ChatWhom, ChatWrit } from '../types/chat';
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
          const lastWritKey =
            index > 0 ? messages.keys().reverse()[index - 1] : undefined;
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
          return (
            <ChatMessage
              key={key.toString()}
              time={key}
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
