import _ from 'lodash';
import React, { useEffect } from 'react';
import { Outlet, useParams } from 'react-router';
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
import { createStorageKey } from '@/logic/utils';
import { useLocalStorage } from 'usehooks-ts';

function ChatChannel({ title }: ViewProps) {
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const flag = useRouteGroup();
  const [, setRecent] = useLocalStorage(
    createStorageKey(`recent-chan:${flag}`),
    ''
  );

  useEffect(() => {
    useChatState.getState().initialize(chFlag);
    setRecent(nest);
  }, [chFlag, nest, setRecent]);

  const messages = useMessagesForChat(chFlag);
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(flag, window.our);
  const canWrite =
    perms.writers.length === 0 ||
    _.intersection(perms.writers, vessel.sects).length !== 0;
  const { sendMessage } = useChatState.getState();

  const channel = useChannel(flag, nest);
  const group = useGroup(flag);

  return (
    <Layout
      className="flex-1 bg-white"
      aside={<Outlet />}
      header={<ChannelHeader flag={flag} nest={nest} />}
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
  );
}

export default ChatChannel;
