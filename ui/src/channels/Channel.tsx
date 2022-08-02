import _ from 'lodash';
import React from 'react';
import { useParams } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useChatIsJoined, useChatState } from '@/state/chat';
import { useRouteGroup } from '@/state/groups/groups';
import ChannelHeader from '@/channels/ChannelHeader';
import ChatChannel from '@/chat/ChatChannel';
import HeapChannel from '@/heap/HeapChannel';

function Channel() {
  const { app, chShip, chName } = useParams();
  const nest = `${chShip}/${chName}`;
  const flag = useRouteGroup();
  const isJoined = useChatIsJoined(nest);
  const join = () => {
    useChatState.getState().joinChat(nest);
  };

  if (app === 'chat' && isJoined) {
    return <ChatChannel flag={flag} nest={nest} />;
  }

  if (app === 'links' && isJoined) {
    return <HeapChannel flag={flag} nest={nest} />;
  }

  return (
    <Layout
      className="flex-1 bg-white"
      header={<ChannelHeader flag={flag} nest={nest} />}
    >
      {isJoined ? (
        <div className="flex h-full w-full flex-col overflow-hidden p-4">
          <h1 className="text-xl font-semibold">Unsupported channel type</h1>
        </div>
      ) : (
        <div className="flex h-full w-full flex-col overflow-hidden p-4">
          <h1 className="text-xl font-semibold">{flag}</h1>
          <button onClick={join}>Join</button>
        </div>
      )}
    </Layout>
  );
}

export default Channel;
