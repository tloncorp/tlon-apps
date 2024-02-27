import { ViewProps } from '@tloncorp/shared/dist/urbit/groups';
import cn from 'classnames';
import React, { useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Route, Routes, useMatch, useParams } from 'react-router';
import { Link, useSearchParams } from 'react-router-dom';

import ChannelHeader from '@/channels/ChannelHeader';
import ChannelSearch from '@/channels/ChannelSearch';
import ChannelTitleButton from '@/channels/ChannelTitleButton';
import ChatInput from '@/chat/ChatInput/ChatInput';
import ChatWindow from '@/chat/ChatWindow';
import Layout from '@/components/Layout/Layout';
import useActiveTab from '@/components/Sidebar/util';
import MagnifyingGlassIcon from '@/components/icons/MagnifyingGlassIcon';
import MagnifyingGlassMobileNavIcon from '@/components/icons/MagnifyingGlassMobileNavIcon';
import { useChatInputFocus } from '@/logic/ChatInputFocusContext';
import { useDragAndDrop } from '@/logic/DragAndDropContext';
import { useFullChannel } from '@/logic/channel';
import { useIsScrolling } from '@/logic/scroll';
import useMedia, { useIsMobile } from '@/logic/useMedia';
import useShowTabBar from '@/logic/useShowTabBar';
import {
  useAddPostMutation,
  useLeaveMutation,
  useReplyPost,
} from '@/state/channel/channel';
import { useRouteGroup } from '@/state/groups/groups';

import ChatThread from './ChatThread/ChatThread';

function ChatChannel({ title }: ViewProps) {
  const { isChatInputFocused } = useChatInputFocus();
  // TODO: We need to reroute users who can't read the channel
  // const navigate = useNavigate();
  const { chShip, chName, idTime, idShip } = useParams<{
    name: string;
    chShip: string;
    ship: string;
    chName: string;
    idShip: string;
    idTime: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const groupFlag = useRouteGroup();
  const chFlag = `${chShip}/${chName}`;
  const nest = `chat/${chFlag}`;
  const isMobile = useIsMobile();
  const isSmall = useMedia('(max-width: 1023px)');
  const inThread = !!idTime;
  const inSearch = useMatch(`/groups/${groupFlag}/channels/${nest}/search/*`);
  const inDmSearch = useMatch(
    `/dm/groups/${groupFlag}/channels/${nest}/search/*`
  );
  const { mutateAsync: leaveChat } = useLeaveMutation();
  const { mutate: sendMessage } = useAddPostMutation(nest);
  const dropZoneId = `chat-input-dropzone-${chFlag}`;
  const { isDragging, isOver } = useDragAndDrop(dropZoneId);
  const chatReplyId = useMemo(
    () => searchParams.get('replyTo'),
    [searchParams]
  );
  const activeTab = useActiveTab();
  const replyingWrit = useReplyPost(nest, chatReplyId);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const isScrolling = useIsScrolling(scrollElementRef);
  const showTabBar = useShowTabBar();
  const root = `${
    activeTab === 'messages' ? '/dm' : ''
  }/groups/${groupFlag}/channels/${nest}`;
  // We only inset the bottom for groups, since DMs display the navbar
  // underneath this view
  const shouldApplyPaddingBottom = showTabBar && !isChatInputFocused;

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
        style={{
          paddingBottom: shouldApplyPaddingBottom ? 50 : 0,
        }}
        className="padding-bottom-transition flex-1 bg-white"
        header={
          <Routes>
            {!isMobile && (
              <Route
                path="search/:query?"
                element={
                  <>
                    <ChannelSearch
                      whom={nest}
                      root={root}
                      placeholder={
                        channel ? `Search in ${channel.meta.title}` : 'Search'
                      }
                    >
                      <ChannelTitleButton flag={groupFlag} nest={nest} />
                    </ChannelSearch>
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
            )}
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
              (isDragging || isOver) && !inThread
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
                autoFocus={!inThread && !inSearch && !inDmSearch}
                dropZoneId={dropZoneId}
                replyingWrit={replyingWrit || undefined}
                isScrolling={isScrolling}
              />
            ) : !canWrite && compatible ? null : (
              <div className="rounded-lg border-2 border-transparent bg-gray-50 px-2 py-1 leading-5 text-gray-600">
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
        <ChatWindow
          scrollElementRef={scrollElementRef}
          isScrolling={isScrolling}
          whom={chFlag}
          root={root}
        />
      </Layout>
      <Routes>
        {isSmall ? null : (
          <Route
            path="message/:idTime/:idReplyTime?"
            element={<ChatThread />}
          />
        )}
      </Routes>
    </>
  );
}

export default ChatChannel;
