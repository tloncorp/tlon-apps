import React from 'react';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import { format } from 'date-fns';
import { ChatWhom, ChatWrit } from '../../types/chat';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';
import DateDivider from './DateDivider';
import ChatMessageOptions from './ChatMessageOptions';

interface ChatMessageProps {
  whom: ChatWhom;
  writ: ChatWrit;
  time: BigInteger;
  newAuthor: boolean;
  newDay: boolean;
}

export default function ChatMessage({
  whom,
  writ,
  time,
  newAuthor,
  newDay,
}: ChatMessageProps) {
  const { seal, memo } = writ;

  const unix = new Date(daToUnix(time));

  return (
    <div className="flex flex-col">
      {newDay ? <DateDivider date={unix} /> : null}
      {newAuthor ? <Author ship={memo.author} date={unix} /> : null}
      <div className="group-one relative z-0 flex">
        <ChatMessageOptions whom={whom} writ={writ} />
        <div className="-ml-1 mr-1 py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
          {format(unix, 'HH:mm')}
        </div>
        <div className="flex w-full flex-col space-y-2 rounded py-1 pl-3 pr-2 group-one-hover:bg-gray-50">
          <ChatContent content={memo.content} />
          {Object.keys(seal.feels).length > 0 && <ChatReactions seal={seal} />}
        </div>
      </div>
    </div>
  );
}
