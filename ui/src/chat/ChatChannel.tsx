import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';
import { Helmet } from 'react-helmet';
import cn from 'classnames';
import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatWindow from '@/chat/ChatWindow';
import Layout from '@/components/Layout/Layout';
import { ViewProps } from '@/types/groups';
import { useChatPerms, useChatState, useMessagesForChat } from '@/state/chat';
import {
  useRouteGroup,
  useVessel,
  useGroup,
  useChannel,
} from '@/state/groups/groups';
import ChannelHeader from '@/channels/ChannelHeader';
import useRecentChannel from '@/logic/useRecentChannel';
import {
  canReadChannel,
  canWriteChannel,
  isChannelJoined,
} from '@/logic/utils';
import useAllBriefs from '@/logic/useAllBriefs';
import ChatScrollerPlaceholder from '@/chat/ChatScoller/ChatScrollerPlaceholder';

function ChatChannel({ title }: ViewProps) {
  const navigate = useNavigate();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const groupFlag = useRouteGroup();
  const { setRecentChannel } = useRecentChannel(groupFlag);
  const [loading, setLoading] = useState(true);
  const messages = useMessagesForChat(chFlag);
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(groupFlag, window.our);
  const channel = useChannel(groupFlag, nest);
  const group = useGroup(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;
  const { sendMessage } = useChatState.getState();
  const briefs = useAllBriefs();
  const joined = isChannelJoined(nest, briefs);

  const joinChannel = useCallback(async () => {
    await useChatState.getState().joinChat(chFlag);
    window.location.reload();
  }, [chFlag]);

  const initializeChannel = useCallback(async () => {
    await useChatState.getState().initialize(chFlag);
    setLoading(false);
  }, [chFlag]);

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel]);

  useEffect(() => {
    setLoading(true);
    if (joined && channel && canRead) {
      initializeChannel();
      setRecentChannel(nest);
    }
  }, [nest, setRecentChannel, initializeChannel, joined, canRead, channel]);

  useEffect(() => {
    if (channel && !canRead) {
      navigate('../../activity');
      setRecentChannel('');
    }
  }, [group, channel, vessel, navigate, setRecentChannel, canRead]);

  return (
    <>
      <Layout
        className="flex-1 bg-white"
        header={<ChannelHeader flag={groupFlag} nest={nest} />}
        footer={
          <div
            className={cn(
              canWrite ? 'border-t-2 border-gray-50 p-3 sm:p-4' : ''
            )}
          >
            {canWrite ? (
              <ChatInput whom={chFlag} sendMessage={sendMessage} showReply />
            ) : null}
          </div>
        }
      >
        <Helmet>
          <title>
            {channel && group
              ? `${channel.meta.title} in ${group.meta.title} ${title}`
              : title}
          </title>
        </Helmet>
        {loading ? (
          <div className="h-full">
            <ChatScrollerPlaceholder count={30} />
          </div>
        ) : (
          <ChatWindow whom={chFlag} messages={messages} />
        )}
      </Layout>
      <Outlet />
    </>
  );
}

export default ChatChannel;
