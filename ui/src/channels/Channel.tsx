import _ from 'lodash';
import React from 'react';
import { useParams } from 'react-router';
import Layout from '@/components/Layout/Layout';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useChannel, useRouteGroup } from '@/state/groups/groups';
import ChannelHeader from '@/channels/ChannelHeader';
import useAllBriefs from '@/logic/useAllBriefs';
import { useDiaryState } from '@/state/diary';
import { isChannelJoined } from '@/logic/utils';

function Channel() {
  const { app, chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `${app}/${chFlag}`;
  const flag = useRouteGroup();
  const channel = useChannel(flag, nest);
  const briefs = useAllBriefs();
  const isJoined = isChannelJoined(nest, briefs);
  const join = () => {
    const joiner =
      app === 'chat'
        ? useChatState.getState().joinChat
        : app === 'heap'
        ? useHeapState.getState().joinHeap
        : useDiaryState.getState().joinDiary;

    joiner(chFlag);
  };

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
