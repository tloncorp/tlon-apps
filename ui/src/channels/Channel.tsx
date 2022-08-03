import _ from 'lodash';
import React from 'react';
import { useParams } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useBriefs, useChatState } from '@/state/chat';
import { useBriefs as useHeapBriefs, useHeapState } from '@/state/heap/heap';
import { useChannel, useRouteGroup } from '@/state/groups/groups';
import ChannelHeader from '@/channels/ChannelHeader';
import ChatChannel from '@/chat/ChatChannel';
import HeapChannel from '@/heap/HeapChannel';
import useAllBriefs from '@/logic/useAllBriefs';

function Channel() {
  const { app, chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `${app}/${chFlag}`;
  const flag = useRouteGroup();
  const channel = useChannel(flag, nest);
  const briefs = useAllBriefs();
  const isJoined = chFlag in briefs;
  const join = () => {
    const joiner =
      app === 'chat'
        ? useChatState.getState().joinChat
        : useHeapState.getState().joinHeap;

    joiner(chFlag);
  };

  if (app === 'chat' && isJoined) {
    return <ChatChannel flag={flag} nest={nest} />;
  }

  if (app === 'heap' && isJoined) {
    return <HeapChannel flag={flag} nest={nest} />;
  }

  return (
    <Layout
      className="flex-1 bg-white"
      header={<ChannelHeader flag={flag} nest={nest} />}
    >
      {isJoined ? (
        <div className="p-4">
          <h1 className="text-xl font-semibold">Unsupported channel type</h1>
        </div>
      ) : (
        <div className="space-y-2 p-4">
          <h1 className="text-xl font-semibold">
            {channel?.meta.title || chFlag}
          </h1>
          <button className="button" onClick={join}>
            Join
          </button>
        </div>
      )}
    </Layout>
  );
}

export default Channel;
