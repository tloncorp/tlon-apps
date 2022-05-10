import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import React from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { useChannelFlag } from '../../hooks';
import { useMessagesForChat, useReplies } from '../../state/chat';
import { useChannel, useRouteGroup } from '../../state/groups';
import ChatInput from '../ChatInput/ChatInput';
import ChatMessage from '../ChatMessage/ChatMessage';
import ChatMessages from '../ChatMessages';
import RowDivider from '../RowDivider';

export default function ChatThread() {
  const flag = useChannelFlag()!;
  const groupFlag = useRouteGroup();
  const time = useParams<{ time: string }>().time!;

  const messages = useMessagesForChat(flag);
  const writ = messages.get(bigInt(udToDec(time)));
  const replies = useReplies(flag, time);
  const channel = useChannel(groupFlag, flag)!;

  return (
    <div className="flex h-full w-72 flex-col space-y-2 border-l p-4">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between">
          <div>Thread: {channel.meta.title}</div>
          <Link to="..">X</Link>
        </div>
        <ChatMessage writ={writ} newAuthor hideReplies />
        <RowDivider
          className="text-gray-400"
          label={`${replies.length} ${
            replies.length === 1 ? 'Reply' : 'Replies'
          }`}
        />
        <div className="flex flex-col">
          <ChatMessages flag={flag} replying={time} />
        </div>
      </div>
      <ChatInput flag={flag} replying={time} />
    </div>
  );
}
