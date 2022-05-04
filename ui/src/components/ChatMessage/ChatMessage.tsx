import React from 'react';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { format } from 'date-fns';
import { ChatWrit } from '../../types/chat';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';
import DateDivider from './DateDivider';
import ChatMessageOptions from './ChatMessageOptions';

interface ChatMessageProps {
  writ: ChatWrit;
  newAuthor: boolean;
  newDay: boolean;
}

export default function ChatMessage({
  writ,
  newAuthor,
  newDay,
}: ChatMessageProps) {
  const { seal, memo } = writ;

  const time = new Date(daToUnix(bigInt(udToDec(seal.time))));

  return (
    <div className="flex flex-col">
      {newDay ? <DateDivider date={time} /> : null}
      {newAuthor ? <Author ship={memo.author} date={time} /> : null}
      <div className="group-one relative z-0 flex space-x-3 rounded hover:bg-gray-50">
        <ChatMessageOptions />
        <div className="py-2 text-xs font-semibold text-gray-400 opacity-0 group-one-hover:opacity-100">
          {format(time, 'HH:mm')}
        </div>
        <div className="flex flex-col space-y-2 px-2 py-1">
          <ChatContent content={memo.content} />
          {Object.keys(seal.feels).length > 0 && <ChatReactions seal={seal} />}
        </div>
      </div>
    </div>
  );
}
