import _ from 'lodash';
import cn from 'classnames';
import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import { Link } from 'react-router-dom';
import BubbleIcon from '@/components/icons/BubbleIcon';
import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatWindow from '@/chat/ChatWindow';
import EllipsisIcon from '@/components/icons/EllipsisIcon';
import Layout from '@/components/Layout/Layout';
import { useIsMobile } from '@/logic/useMedia';
import {
  useChatIsJoined,
  useChatPerms,
  useChatState,
  useMessagesForChat,
} from '@/state/chat';
import {
  useChannel,
  useRouteGroup,
  useVessel,
  useGroup,
} from '@/state/groups/groups';
import CaretLeftIcon from '@/components/icons/CaretLeftIcon';
import useNavStore from '@/components/Nav/useNavStore';

function Channel() {
  const { app, chShip, chName } = useParams();
  const flag = `${chShip}/${chName}`;
  const nest = `${app}/${flag}`;
  const groupFlag = useRouteGroup();
  const group = useGroup(groupFlag);
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
  const channel = useChannel(groupFlag, nest)!;
  const { sendMessage } = useChatState.getState();
  const groupName = group?.meta.title;

  return (
    <Layout
      className="flex-1 bg-white"
      aside={<Outlet />}
      header={
        <div
          className={cn(
            'flex h-full items-center border-b-2 border-gray-50 p-2'
          )}
        >
          <button
            className={cn(
              'cursor-pointer select-none p-2 sm:cursor-text sm:select-text',
              isMobile && '-ml-2 flex items-center rounded-lg hover:bg-gray-50'
            )}
            aria-label="Open Channels Menu"
            onClick={() => isMobile && navPrimary('group', groupFlag)}
          >
            {isMobile ? (
              <CaretLeftIcon className="mr-1 h-5 w-5 text-gray-500" />
            ) : null}
            <div className="flex items-center space-x-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-50">
                {/* TODO: Channel Type icons */}
                <BubbleIcon className="h-4 w-4 text-gray-400" />
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-sm font-medium text-gray-600">
                  {groupName}
                </span>
                <div className="text-md font-semibold">
                  {channel.meta.title}
                </div>
              </div>
            </div>
          </button>

          <Link
            className="icon-button ml-auto h-8 w-8 bg-transparent"
            to={`/groups/${groupFlag}/info/channels`}
          >
            <EllipsisIcon className="h-6 w-6" />
          </Link>
        </div>
      }
      footer={
        <div className="border-t-2 border-gray-50 p-4">
          {canWrite ? (
            <ChatInput whom={flag} sendMessage={sendMessage} showReply />
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
