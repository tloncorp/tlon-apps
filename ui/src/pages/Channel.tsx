import _ from 'lodash';
import React from 'react';
import { Outlet, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '../components/ChatInput/ChatInput';
import ChatWindow from '../components/ChatWindow';
import ElipsisIcon from '../components/icons/ElipsisIcon';
import MenuIcon from '../components/icons/MenuIcon';
import Layout from '../components/layout/Layout';
import { useChatIsJoined, useChatPerms, useChatState } from '../state/chat';
import { useChannel, useRouteGroup, useVessel } from '../state/groups';
import useSidebars from '../state/sidebars';
import { channelHref } from '../utils';

function Channel() {
  const { chShip, chName } = useParams();
  const flag = `${chShip}/${chName}`;
  const groupFlag = useRouteGroup();
  const isJoined = useChatIsJoined(flag);
  const join = () => {
    useChatState.getState().joinChat(flag);
  };
  const { transition, isMobile } = useSidebars();

  const perms = useChatPerms(flag);
  const vessel = useVessel(groupFlag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const channel = useChannel(groupFlag, flag)!;

  return (
    <Layout
      className="flex-1"
      aside={<Outlet />}
      header={
        <div className="flex h-full items-center border-b-2 border-gray-50 p-4">
          <h3 className="text-lg font-bold">{channel.meta.title}</h3>
          {isMobile ? (
            <button
              className="icon-button h-8 w-8"
              onClick={() => transition('channels-open')}
              aria-label="Open Channels Menu"
            >
              <MenuIcon className="h-8 w-8" />
            </button>
          ) : null}
          <Link
            className="icon-button ml-auto h-8 w-8"
            to={`${channelHref(groupFlag, flag)}/settings`}
          >
            <ElipsisIcon className="h-5 w-5" />
          </Link>
        </div>
      }
      footer={
        <div className="p-4">
          {canWrite ? (
            <ChatInput whom={flag} />
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
