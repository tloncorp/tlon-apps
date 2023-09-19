import cn from 'classnames';
import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Route, Routes, useMatch, useParams } from 'react-router';
import { Helmet } from 'react-helmet';
import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatWindow from '@/chat/ChatWindow';
import Layout from '@/components/Layout/Layout';
import { ViewProps } from '@/types/groups';
import { useChatState } from '@/state/chat';
import { useRouteGroup } from '@/state/groups/groups';
import ChannelHeader from '@/channels/ChannelHeader';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import useMedia, { useIsMobile } from '@/logic/useMedia';
import ChannelTitleButton from '@/channels/ChannelTitleButton';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useFullChannel } from '@/logic/channel';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import { useAddNoteMutation, useLeaveMutation } from '@/state/channel/channel';
import ChatSearch from './ChatSearch/ChatSearch';
import ChatThread from './ChatThread/ChatThread';

function ChatChannel({ title }: ViewProps) {
  const { chShip, chName, idTime, idShip } = useParams<{
    name: string;
    chShip: string;
    ship: string;
    chName: string;
    idShip: string;
    idTime: string;
  }>();
  const groupFlag = useRouteGroup();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const isMobile = useIsMobile();
  const isSmall = useMedia('(max-width: 1023px)');
  const inThread = idShip && idTime;
  const inSearch = useMatch(`/groups/${groupFlag}/channels/${nest}/search/*`);
  const { mutateAsync: leaveChat } = useLeaveMutation();
  const { mutate: sendMessage } = useAddNoteMutation(nest);
  const dropZoneId = `chat-input-dropzone-${chFlag}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);

  const {
    group,
    groupChannel: channel,
    canWrite,
    compat: { compatible, text },
  } = useFullChannel({
    groupFlag,
    nest,
  });

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
                    root={`/groups/${groupFlag}/channels/${nest}`}
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
                  leave={leaveChat}
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
              !canWrite || ((isDragging || isOver) && !inThread)
                ? ''
                : 'border-t-2 border-gray-50 p-3 sm:p-4'
            )}
          >
            {compatible && canWrite ? (
              <ChatInput
                key={chFlag}
                whom={chFlag}
                sendChatMessage={sendMessage}
                showReply
                autoFocus={!inThread && !inSearch}
                dropZoneId={dropZoneId}
              />
            ) : !canWrite ? null : (
              <div className="rounded-lg border-2 border-transparent bg-gray-50 py-1 px-2 leading-5 text-gray-600">
                {text}
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
        <ChatWindow whom={chFlag} />
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
