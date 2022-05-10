import _ from 'lodash';
import React from 'react';
import { useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '../components/ChatInput/ChatInput';
import ChatWindow from '../components/ChatWindow';
import ElipsisIcon from '../components/icons/ElipsisIcon';
import MenuIcon from '../components/icons/MenuIcon';
import Layout from '../components/layout/Layout';
import { useChatIsJoined, useChatPerms, useChatState } from '../state/chat';
import { useRouteGroup, useVessel } from '../state/groups';
import { channelHref } from '../utils';

function Channel() {
  const { chShip, chName } = useParams();
  const flag = `${chShip}/${chName}`;
  const groupFlag = useRouteGroup();
  const isJoined = useChatIsJoined(flag);
  const join = () => {
    useChatState.getState().joinChat(flag);
  };

  const perms = useChatPerms(flag);
  const vessel = useVessel(groupFlag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;

  return (
    <Layout
      className="flex-1"
      header={
        <div className="flex items-center border-b-2 border-gray-50 p-4">
          <button className="icon-button h-8 w-8">
            <MenuIcon className="h-8 w-8" />
          </button>
          <Link
            className="icon-button ml-auto h-8 w-8"
            to={`${channelHref(groupFlag, flag)}/settings`}
          >
            <ElipsisIcon className="h-6 w-6" />
          </Link>
        </div>
      }
      footer={
        <div className="p-4">
          {canWrite ? (
            <ChatInput flag={flag} />
          ) : (
            <span>Cannot write to this channel</span>
          )}
        </div>
      }
    >
      {isJoined ? (
        <ChatWindow flag={flag} />
      ) : (
        <div>
          <h1>{flag}</h1>
          <button onClick={join}>Join</button>
        </div>
      )}
    </Layout>
  );
}

export default Channel;
