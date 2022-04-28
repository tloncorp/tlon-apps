import React from 'react';
import { daToUnix, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { format } from 'date-fns';
import { ChatWrit } from '../../types/chat';
import Author from './Author';
import ChatContent from '../chat-content/ChatContent';
import ChatReactions from '../chat-reactions/ChatReactions';

interface ChatMessageProps {
  writ: ChatWrit;
  newAuthor: boolean;
}

export default function ChatMessage({ writ, newAuthor }: ChatMessageProps) {
  const { seal, memo } = writ;

  const time = new Date(daToUnix(bigInt(udToDec(seal.time))));

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex">{newAuthor && <Author ship={memo.author} />}</div>
      <div className="flex space-x-3">
        <div className="text-xs font-semibold text-gray-400">
          {format(time, 'HH:mm')}
        </div>
        <div className="flex flex-col space-y-2">
          <ChatContent content={memo.content} />
          {Object.keys(seal.feels).length > 0 && <ChatReactions seal={seal} />}
        </div>
      </div>
    </div>
  );
}
