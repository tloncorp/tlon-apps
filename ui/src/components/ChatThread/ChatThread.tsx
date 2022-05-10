import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import React from 'react';
import { useParams } from 'react-router';
import { useChannelFlag } from '../../hooks';
import { useMessagesForChat, useReplies } from '../../state/chat';
import ChatInput from '../ChatInput/ChatInput';
import ChatMessage from '../ChatMessage/ChatMessage';
import ChatMessages from '../ChatMessages';

export default function ChatThread() {
  const flag = useChannelFlag()!;
  const time = useParams<{ time: string }>().time!;

  const messages = useMessagesForChat(flag);
  const writ = messages.get(bigInt(udToDec(time)));
  const replies = useReplies(flag, time);

  return (
    <div className="flex h-full w-72 flex-col space-y-2 border-l p-2">
      <div className="flex flex-col space-y-2">
        <ChatMessage writ={writ} newAuthor />
        <div className="flex flex-col">
          <ChatMessages flag={flag} replying={time} />
        </div>
      </div>
      <ChatInput flag={flag} replying={time} />
    </div>
  );
}
