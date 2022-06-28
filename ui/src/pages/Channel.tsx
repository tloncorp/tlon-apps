import _ from 'lodash';
import cn from 'classnames';
import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import ChatInput from '../chat/ChatInput/ChatInput';
import ChatWindow from '../chat/ChatWindow';
import EllipsisIcon from '../components/icons/EllipsisIcon';
import Layout from '../components/Layout/Layout';
import { useIsMobile } from '../logic/useMedia';
import {
  useChatIsJoined,
  useChatPerms,
  useChatState,
  useMessagesForChat,
} from '../state/chat';
import { useChannel, useRouteGroup, useVessel } from '../state/groups';
import { channelHref } from '../logic/utils';
import { useChatInfo } from '../chat/useChatStore';
import CaretLeftIcon from '../components/icons/CaretLeftIcon';
import useNavStore from '../components/Nav/useNavStore';

function Channel() {
  const { chShip, chName } = useParams();
  const flag = `${chShip}/${chName}`;
  const chatInfo = useChatInfo(flag);
  const groupFlag = useRouteGroup();
  const isJoined = useChatIsJoined(flag);
  const join = () => {
    useChatState.getState().joinChat(flag);
  };
  const isMobile = useIsMobile();
  const navPrimary = useNavStore((state) => state.navigatePrimary);

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
  const { sendMessage } = useChatState.getState();

  return (
    <Layout
      className="flex-1 bg-white"
      aside={<Outlet />}
      header={
        <div
          className={cn(
            'flex w-full items-center',
            isMobile && 'px-2 py-1',
            !isMobile && 'border-b-2 border-gray-50 p-4'
          )}
        >
          <button
            className={cn(
              isMobile && 'flex items-center rounded-lg p-2 hover:bg-gray-50'
            )}
            aria-label="Open Channels Menu"
            onClick={() => isMobile && navPrimary('group', groupFlag)}
          >
            {isMobile ? (
              <CaretLeftIcon className="mr-4 h-6 w-6 text-gray-400" />
            ) : null}
            <h1 className="text-xl font-medium">{channel.meta.title}</h1>
          </button>

          <Link
            className="icon-button ml-auto h-8 w-8 bg-transparent"
            to={`${channelHref(groupFlag, flag)}/settings`}
          >
            <EllipsisIcon className="h-6 w-6" />
          </Link>
        </div>
      }
      footer={
        <div className="border-t-2 border-black/10 p-4">
          {canWrite ? (
            <ChatInput
              whom={flag}
              replying={chatInfo?.replying || null}
              sendMessage={sendMessage}
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
