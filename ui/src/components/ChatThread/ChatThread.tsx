import { udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import React from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import { useChannelFlag } from '../../hooks';
import { useMessagesForChat, useReplies, useWrit } from '../../state/chat';
import { useChannel, useRouteGroup } from '../../state/groups';
import ChatInput from '../ChatInput/ChatInput';
import ChatMessage from '../ChatMessage/ChatMessage';
import ChatMessages from '../ChatMessages';
import RowDivider from '../RowDivider';

export function GroupChatThread() {
  const flag = useChannelFlag()!;
  const groupFlag = useRouteGroup();
  const channel = useChannel(groupFlag, flag)!;

  return (
    <ChatThread whom={flag}>
      <div>Thread: {channel.meta.title}</div>
    </ChatThread>
  );
}

export function DmThread() {
  const ship = useParams<{ ship: string }>().ship!;

  return (
    <ChatThread whom={ship}>
      <div>Thread: {ship}</div>
    </ChatThread>
  );
}

export default function ChatThread(
  props: React.PropsWithChildren<{ whom: string }>
) {
  const { whom, children } = props;
  const { idTime, idShip } = useParams<{ idShip: string; idTime: string }>();

  const id = `${idShip!}/${idTime!}`;
  const maybeWrit = useWrit(whom, id);
  const replies = useReplies(whom, id);
  console.log(replies);

  if (!maybeWrit) {
    return null;
  }
  const [time, writ] = maybeWrit;

  return (
    <div className="flex h-full min-w-72 flex-col space-y-2 border-l p-4 xl:min-w-96">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between">
          {children}
          <Link to="..">X</Link>
        </div>
        <ChatMessage
          whom={whom}
          time={time}
          writ={writ}
          newAuthor
          hideReplies
        />
        <RowDivider
          className="text-gray-400"
          label={`${replies.size} ${replies.size === 1 ? 'Reply' : 'Replies'}`}
        />
        <div className="flex flex-col">
          <ChatMessages messages={replies} whom={whom} replying={true} />
        </div>
      </div>
      <ChatInput whom={whom} replying={id} />
    </div>
  );
}
