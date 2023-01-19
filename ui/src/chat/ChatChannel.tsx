import React, { useEffect } from 'react';
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
import { canReadChannel, canWriteChannel } from '@/logic/utils';

function ChatChannel({ title }: ViewProps) {
  const navigate = useNavigate();
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const groupFlag = useRouteGroup();
  const { setRecentChannel } = useRecentChannel(groupFlag);

  useEffect(() => {
    useChatState.getState().initialize(chFlag);
    setRecentChannel(nest);
  }, [chFlag, nest, setRecentChannel]);

  const messages = useMessagesForChat(chFlag);
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(groupFlag, window.our);
  const channel = useChannel(groupFlag, nest);
  const group = useGroup(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const { sendMessage } = useChatState.getState();

  useEffect(() => {
    if (channel && !canReadChannel(channel, vessel, group?.bloc)) {
      navigate('../../activity');
      setRecentChannel('');
    }
  }, [group, channel, vessel, navigate, setRecentChannel]);

  return (
    <>
      <Layout
        className="flex-1 bg-white"
        header={<ChannelHeader flag={groupFlag} nest={nest} />}
        footer={
          <div className={cn(canWrite ? 'border-t-2 border-gray-50 p-4' : '')}>
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
        <ChatWindow whom={chFlag} messages={messages} />
      </Layout>
      <Outlet />
    </>
  );
}

export default ChatChannel;
