import React, { useEffect, useState, useCallback } from 'react';
import { Outlet, Route, Routes, useNavigate, useParams } from 'react-router';
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
  isTalk,
} from '@/logic/utils';
import useAllBriefs from '@/logic/useAllBriefs';
import ChatScrollerPlaceholder from '@/chat/ChatScoller/ChatScrollerPlaceholder';
import { useLastReconnect } from '@/state/local';
import { Link } from 'react-router-dom';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import ChatSearchResults from './ChatSearch/ChatSearchResults';
import ChatSearch from './ChatSearch/ChatSearch';

function ChatChannel({ title }: ViewProps) {
  const navigate = useNavigate();
  const { chShip, chName, idTime, idShip } = useParams<{
    name: string;
    chShip: string;
    ship: string;
    chName: string;
    idShip: string;
    idTime: string;
  }>();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const groupFlag = useRouteGroup();
  const { setRecentChannel } = useRecentChannel(groupFlag);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const messages = useMessagesForChat(chFlag);
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(groupFlag, window.our);
  const channel = useChannel(groupFlag, nest);
  const group = useGroup(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;
  const inThread = idShip && idTime;
  const { sendMessage } = useChatState.getState();
  const briefs = useAllBriefs();
  const joined = Object.keys(briefs).some((k) => k.includes('chat/'))
    ? isChannelJoined(nest, briefs)
    : true;
  const needsLoader = messages.size === 0;
  const lastReconnect = useLastReconnect();

  const joinChannel = useCallback(async () => {
    setJoining(true);
    try {
      await useChatState.getState().joinChat(groupFlag, chFlag);
    } catch (e) {
      console.log("Couldn't join chat (maybe already joined)", e);
    }
    setJoining(false);
  }, [groupFlag, chFlag]);

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
    if (needsLoader) {
      setLoading(true);
    }

    if (joined && canRead && !joining) {
      initializeChannel();
      setRecentChannel(nest);
    }
  }, [
    needsLoader,
    nest,
    setRecentChannel,
    initializeChannel,
    joined,
    canRead,
    channel,
    joining,
    lastReconnect,
  ]);

  useEffect(() => {
    if (channel && !canRead) {
      if (isTalk) {
        navigate('/');
      } else {
        navigate(`/groups/${groupFlag}`);
      }
      setRecentChannel('');
    }
  }, [groupFlag, group, channel, vessel, navigate, setRecentChannel, canRead]);

  return (
    <>
      <Layout
        className="flex-1 bg-white"
        header={
          <ChannelHeader
            flag={groupFlag}
            nest={nest}
            prettyAppName="Chat"
            leave={useChatState.getState().leaveChat}
          >
            <Routes>
              <Route path="search*" element={<ChatSearch />} />
              <Route
                path="*"
                element={
                  <Link
                    to="search"
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50"
                    aria-label="Search Chat"
                  >
                    <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
                  </Link>
                }
              />
            </Routes>
          </ChannelHeader>
        }
        footer={
          <div
            className={cn(
              canWrite ? 'border-t-2 border-gray-50 p-3 sm:p-4' : ''
            )}
          >
            {canWrite ? (
              <ChatInput
                key={chFlag}
                whom={chFlag}
                sendMessage={sendMessage}
                showReply
                autoFocus={!inThread}
              />
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
        <Routes>
          <Route
            path="search/:query"
            element={<ChatSearchResults whom={chFlag} messages={messages} />}
          />
          <Route
            path="*"
            element={
              loading ? (
                <div className="h-full">
                  <ChatScrollerPlaceholder count={30} />
                </div>
              ) : (
                <ChatWindow whom={chFlag} messages={messages} />
              )
            }
          />
        </Routes>
      </Layout>
      <Outlet />
    </>
  );
}

export default ChatChannel;
