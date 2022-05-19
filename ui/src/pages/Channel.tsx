import _ from 'lodash';
import cn from 'classnames';
import React, { useEffect } from 'react';
import { Outlet, useLocation, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '../chat/ChatInput/ChatInput';
import ChatWindow from '../chat/ChatWindow';
import ElipsisIcon from '../components/icons/ElipsisIcon';
import Layout from '../components/layout/Layout';
import useMedia from '../logic/useMedia';
import {
  useChatIsJoined,
  useChatPerms,
  useChatState,
  useMessagesForChat,
} from '../state/chat';
import { useChannel, useRouteGroup, useVessel } from '../state/groups';
import { channelHref } from '../logic/utils';
import { useChatInfo } from '../chat/useChatStore';
import LeftIcon from '../components/icons/LeftIcon';

function Channel() {
  const { chShip, chName } = useParams();
  const flag = `${chShip}/${chName}`;
  const chatInfo = useChatInfo(flag);
  const groupFlag = useRouteGroup();
  const isJoined = useChatIsJoined(flag);
  const join = () => {
    useChatState.getState().joinChat(flag);
  };
  const location = useLocation();
  const isMobile = useMedia('(max-width: 639px)');

  useEffect(() => {
    useChatState.getState().initialize(flag);
  }, [flag]);

  const messages = useMessagesForChat(flag);
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
          <Link
            to=".."
            state={{ backgroundLocation: location }}
            className={cn(
              isMobile &&
                '-ml-2 flex items-center rounded-md p-2 hover:bg-gray-50'
            )}
            aria-label="Open Channels Menu"
          >
            {isMobile ? (
              <LeftIcon className="mr-1 h-5 w-5 text-gray-500" />
            ) : null}
            <h1 className="text-lg font-bold">{channel.meta.title}</h1>
          </Link>

          <Link
            className="icon-button ml-auto h-8 w-8"
            to={`${channelHref(groupFlag, flag)}/settings`}
          >
            <ElipsisIcon className="h-5 w-5" />
          </Link>
        </div>
      }
      footer={
        <div className="border-t-2 border-black/10 p-4">
          {canWrite ? (
            <ChatInput
              whom={flag}
              replying={chatInfo?.replying || null}
              showReply
            />
          ) : (
            <span>Cannot write to this channel</span>
          )}
        </div>
      }
    >
      {isJoined ? (
        <ChatWindow whom={flag} messages={messages} />
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
