import React from 'react';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { format } from 'date-fns';
import { ChatWrit } from '../../types/chat';
import Author from './Author';
import ChatContent from '../ChatContent/ChatContent';
import ChatReactions from '../ChatReactions/ChatReactions';
import DateDivider from './DateDivider';

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
      <div className="group flex space-x-3">
        <div className="py-3 text-xs font-semibold text-gray-400 opacity-0 group-hover:opacity-100">
          {format(time, 'HH:mm')}
        </div>
        <div className="flex flex-col space-y-2 p-2">
          <ChatContent content={memo.content} />
          {Object.keys(seal.feels).length > 0 && <ChatReactions seal={seal} />}
        </div>
      </div>
    </div>
  );
}
