import React, { PropsWithChildren } from 'react';
import { useLocation, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import useIsChat from '@/logic/useIsChat';
import { udToDec } from '@urbit/api';
import { useChannelFlag } from '../../hooks';
import { useChatState, useReplies, useWrit } from '../../state/chat';
import { useChannel, useRouteGroup } from '../../state/groups/groups';
import ChatInput from '../ChatInput/ChatInput';
import ChatMessage from '../ChatMessage/ChatMessage';
import RowDivider from '../../components/RowDivider';
import X16Icon from '../../components/icons/X16Icon';
import ChatScroller from '../ChatScroller/ChatScroller';

type ChatThreadProps = PropsWithChildren<{
  whom: string;
}>;

export default function ChatThread({ whom, children }: ChatThreadProps) {
  const { ship, name, chShip, chName, idTime, idShip } = useParams<{
    ship: string;
    name: string;
    chShip: string;
    chName: string;
    idShip: string;
    idTime: string;
  }>();
  const { sendMessage } = useChatState.getState();
  const location = useLocation();

  const id = `${idShip!}/${idTime!}`;
  const maybeWrit = useWrit(whom, id);
  const replies = useReplies(whom, id);

  if (!maybeWrit) {
    return null;
  }
  const [time, writ] = maybeWrit;

  const returnURL = () => {
    if (location.pathname.includes('groups')) {
      return `/groups/${ship}/${name}/channels/chat/${chShip}/${chName}?msg=${time.toString()}`;
    }
    return `/dm/${ship}?msg=${time.toString()}`;
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-white lg:w-96 lg:border-l">
      <div className="space-y-2 p-4">
        <div className="sticky top-0 z-10 flex justify-between rounded border bg-white p-3 ">
          {children}
          <Link to={returnURL()}>
            <X16Icon className="h-4 w-4 text-gray-400" />
          </Link>
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
      </div>
      <div className="flex flex-1 flex-col p-2">
        <ChatScroller messages={replies} whom={whom} replying />
      </div>
      <div className="sticky bottom-0 z-10 border-t-2 border-gray-50 bg-white p-4">
        <ChatInput whom={whom} replying={id} sendMessage={sendMessage} />
      </div>
    </div>
  );
}

export function GroupChatThread() {
  const flag = useChannelFlag()!;
  const groupFlag = useRouteGroup();
  const channel = useChannel(groupFlag, flag)!;

  return (
    <ChatThread whom={flag}>
      <div>Thread: {channel?.meta.title || ''}</div>
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
