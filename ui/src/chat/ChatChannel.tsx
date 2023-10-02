import cn from 'classnames';
import React, { useEffect, useState, useCallback } from 'react';
import { Route, Routes, useMatch, useNavigate, useParams } from 'react-router';
import { Helmet } from 'react-helmet';
import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatWindow from '@/chat/ChatWindow';
import Layout from '@/components/Layout/Layout';
import { ViewProps } from '@/types/groups';
import { useChatPerms, useChatState } from '@/state/chat';
import {
  useRouteGroup,
  useVessel,
  useGroup,
  useChannel,
} from '@/state/groups/groups';
import ChannelHeader from '@/channels/ChannelHeader';
import useRecentChannel from '@/logic/useRecentChannel';
import { canReadChannel, canWriteChannel, isTalk } from '@/logic/utils';
import { useLastReconnect } from '@/state/local';
import { Link } from 'react-router-dom';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import useMedia, { useIsMobile } from '@/logic/useMedia';
import ChannelTitleButton from '@/channels/ChannelTitleButton';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useChannelCompatibility, useChannelIsJoined } from '@/logic/channel';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import { useSafeAreaInsets } from '@/logic/native';
import ChatSearch from './ChatSearch/ChatSearch';
import ChatThread from './ChatThread/ChatThread';

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
  const dropZoneId = `chat-input-dropzone-${chFlag}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const nest = `chat/${chFlag}`;
  const groupFlag = useRouteGroup();
  const { setRecentChannel } = useRecentChannel(groupFlag);
  const [joining, setJoining] = useState(false);
  const perms = useChatPerms(chFlag);
  const vessel = useVessel(groupFlag, window.our);
  const channel = useChannel(groupFlag, nest);
  const group = useGroup(groupFlag);
  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;
  const inThread = idShip && idTime;
  const inSearch = useMatch(`/groups/${groupFlag}/channels/${nest}/search/*`);
  const { sendMessage } = useChatState.getState();
  const joined = useChannelIsJoined(nest);
  const lastReconnect = useLastReconnect();
  const isSmall = useMedia('(max-width: 1023px)');
  const { compatible, text: compatibilityError } =
    useChannelCompatibility(nest);
  const isMobile = useIsMobile();
  const safeAreaInsets = useSafeAreaInsets();
  // We only inset the bottom for groups, since DMs display the navbar
  // underneath this view
  const bottomInset = group ? safeAreaInsets.bottom : 0;
  const root = `/groups/${groupFlag}/channels/${nest}`;

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
  }, [chFlag]);

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel]);

  useEffect(() => {
    if (joined && canRead && !joining) {
      initializeChannel();
      setRecentChannel(nest);
    }
  }, [
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
          <Routes>
            <Route
              path="search/:query?"
              element={
                <>
                  <ChatSearch
                    whom={chFlag}
                    root={root}
                    placeholder={
                      channel ? `Search in ${channel.meta.title}` : 'Search'
                    }
                  >
                    <ChannelTitleButton flag={groupFlag} nest={nest} />
                  </ChatSearch>
                  <Helmet>
                    <title>
                      {channel && group
                        ? `${channel.meta.title} in ${group.meta.title} Search`
                        : 'Search'}
                    </title>
                  </Helmet>
                </>
              }
            />
            <Route
              path="*"
              element={
                <ChannelHeader
                  groupFlag={groupFlag}
                  nest={nest}
                  prettyAppName="Chat"
                  leave={useChatState.getState().leaveChat}
                >
                  <Link
                    to="search/"
                    className={cn(
                      isMobile
                        ? ''
                        : 'default-focus flex h-6 w-6 items-center justify-center rounded hover:bg-gray-50'
                    )}
                    aria-label="Search Chat"
                  >
                    {isMobile ? (
                      <MagnifyingGlassMobileNavIcon className="h-6 w-6 text-gray-800" />
                    ) : (
                      <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
                    )}
                  </Link>
                </ChannelHeader>
              }
            />
          </Routes>
        }
        footer={
          <div
            className={cn(
              (isDragging || isOver) && !inThread
                ? ''
                : 'border-t-2 border-gray-50 p-3 sm:p-4'
            )}
          >
            {compatible && canWrite ? (
              <div style={{ paddingBottom: bottomInset }}>
                <ChatInput
                  key={chFlag}
                  whom={chFlag}
                  sendMessage={sendMessage}
                  showReply
                  autoFocus={!inThread && !inSearch}
                  dropZoneId={dropZoneId}
                />
              </div>
            ) : (
              <div className="rounded-lg border-2 border-transparent bg-gray-50 py-1 px-2 leading-5 text-gray-400">
                {!compatible
                  ? compatibilityError
                  : 'You need permission to post to this channel.'}
              </div>
            )}
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
        <ChatWindow whom={chFlag} root={root} />
      </Layout>
      <Routes>
        {isSmall ? null : (
          <Route path="message/:idShip/:idTime" element={<ChatThread />} />
        )}
      </Routes>
    </>
  );
}

export default ChatChannel;
