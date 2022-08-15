import _ from 'lodash';
import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatWindow from '@/chat/ChatWindow';
import Layout from '@/components/Layout/Layout';
import { useChatPerms, useChatState, useMessagesForChat } from '@/state/chat';
import { useRouteGroup, useVessel } from '@/state/groups/groups';
import ChannelHeader from '@/channels/ChannelHeader';

export interface ChatChannelProps {}

function ChatChannel(props: ChatChannelProps) {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const flag = useRouteGroup();

  useEffect(() => {
    useChatState.getState().initialize(nest);
  }, [nest]);

  const messages = useMessagesForChat(nest);
  const perms = useChatPerms(nest);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const { sendMessage } = useChatState.getState();

  return (
    <Layout
      className="flex-1 bg-white"
      aside={<Outlet />}
      header={<ChannelHeader flag={flag} nest={nest} />}
      footer={
        <div className="border-t-2 border-gray-50 p-4">
          {canWrite ? (
            <ChatInput whom={nest} sendMessage={sendMessage} showReply />
          ) : (
            <span>Cannot write to this channel</span>
          )}
        </div>
      }
    >
      <ChatWindow whom={nest} messages={messages} />
    </Layout>
  );
}

export default ChatChannel;
