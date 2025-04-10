import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Text } from '@tloncorp/ui';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { ChatList } from '../../features/chat-list/ChatList';
import {
  CreateChatSheet,
  CreateChatSheetMethods,
} from '../../features/top/CreateChatSheet';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useFilteredChats } from '../../hooks/useFilteredChats';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useRenderCount } from '../../hooks/useRenderCount';
import { useResolvedChats } from '../../hooks/useResolvedChats';
import {
  ChatOptionsProvider,
  GroupPreviewAction,
  GroupPreviewSheet,
  InviteUsersSheet,
  NavigationProvider,
  RequestsProvider,
  ScreenHeader,
  View,
  useGlobalSearch,
} from '../../ui';
import { identifyTlonEmployee } from '../../utils/posthog';
import { useRootNavigation } from '../utils';

const logger = createDevLogger('HomeSidebar', false);

interface Props {
  previewGroupId?: string;
  focusedChannelId?: string;
}

export const HomeSidebar = memo(
  ({ previewGroupId, focusedChannelId }: Props) => {
    const screenTitle = 'Home';
    const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>();

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
      previewGroupId ?? null
    );
    const { data: selectedGroup } = store.useGroup({
      id: selectedGroupId ?? '',
    });
    const { setIsOpen } = useGlobalSearch();

    // const isFocused = useIsFocused();

    const { data: chats } = store.useCurrentChats();
    const { performGroupAction } = useGroupActions();

    const connStatus = store.useConnectionStatus();
    const notReadyMessage: string | null = useMemo(() => {
      // if not fully connected yet, show status
      if (connStatus !== 'Connected') {
        return `${connStatus}...`;
      }

      // if still loading the screen data, show loading
      if (!chats) {
        return 'Loading...';
      }

      return null;
    }, [connStatus, chats]);

    const noChats = useMemo(
      () =>
        chats?.pinned.length === 0 &&
        chats?.unpinned.length === 0 &&
        chats?.pending.length === 0,
      [chats]
    );

    /* Log an error if this screen takes more than 30 seconds to resolve to "Connected" */
    const connectionTimeout = useRef<NodeJS.Timeout | null>(null);
    const connectionAttempts = useRef(0);

    useEffect(() => {
      const checkConnection = () => {
        if (connStatus === 'Connected') {
          if (connectionTimeout.current) {
            clearTimeout(connectionTimeout.current);
          }
          connectionAttempts.current = 0;
        } else {
          connectionAttempts.current += 1;
          if (connectionAttempts.current >= 10) {
            logger.error('Connection not established within 10 seconds');
            if (connectionTimeout.current) {
              clearTimeout(connectionTimeout.current);
            }
          } else {
            connectionTimeout.current = setTimeout(checkConnection, 1000);
          }
        }
      };

      checkConnection();

      return () => {
        if (connectionTimeout.current) {
          clearTimeout(connectionTimeout.current);
        }
      };
    }, [connStatus]);

    const resolvedChats = useResolvedChats(chats);
    const { navigateToGroup, navigateToChannel } = useRootNavigation();

    const createChatSheetRef = useRef<CreateChatSheetMethods | null>(null);
    const onPressChat = useCallback(
      async (item: db.Chat) => {
        if (item.type === 'group') {
          if (item.isPending) {
            setSelectedGroupId(item.id);
          } else {
            navigateToGroup(item.group.id);
          }
        } else {
          navigateToChannel(item.channel);
        }
      },
      [navigateToGroup, navigateToChannel]
    );

    const handlePressAddChat = useCallback(() => {
      createChatSheetRef.current?.open();
    }, []);

    const handleGroupPreviewSheetOpenChange = useCallback((open: boolean) => {
      if (!open) {
        setSelectedGroupId(null);
      }
    }, []);

    const handleInviteSheetOpenChange = useCallback((open: boolean) => {
      if (!open) {
        setInviteSheetGroup(null);
      }
    }, []);

    const isTlonEmployee = useMemo(() => {
      const allChats = [...resolvedChats.pinned, ...resolvedChats.unpinned];
      return !!allChats.find(
        (chat) => chat.type === 'group' && chat.group.id === TLON_EMPLOYEE_GROUP
      );
    }, [resolvedChats.pinned, resolvedChats.unpinned]);

    useEffect(() => {
      if (isTlonEmployee && TLON_EMPLOYEE_GROUP !== '') {
        identifyTlonEmployee();
      }
    }, [isTlonEmployee]);

    const handleGroupAction = useCallback(
      (action: GroupPreviewAction, group: db.Group) => {
        performGroupAction(action, group);
        setSelectedGroupId(null);
      },
      [performGroupAction]
    );

    const handleSearch = useCallback(() => {
      setIsOpen(true);
    }, [setIsOpen]);

    const handlePressInvite = useCallback((groupId: string) => {
      setInviteSheetGroup(groupId);
    }, []);

    const displayData = useFilteredChats({
      ...resolvedChats,
      searchQuery: '',
      activeTab: 'home',
    });

    useRenderCount('HomeSidebar');

    return (
      <RequestsProvider
        usePostReference={store.usePostReference}
        useChannel={store.useChannelPreview}
        usePost={store.usePostWithRelations}
        useApp={db.appInfo.useValue}
        useGroup={store.useGroupPreview}
      >
        <ChatOptionsProvider
          {...useChatSettingsNavigation()}
          onPressInvite={handlePressInvite}
        >
          <NavigationProvider focusedChannelId={focusedChannelId}>
            <View userSelect="none" flex={1}>
              <ScreenHeader
                title={notReadyMessage ?? screenTitle}
                rightControls={
                  <>
                    <ScreenHeader.IconButton
                      type="Search"
                      onPress={handleSearch}
                    />
                    <CreateChatSheet
                      ref={createChatSheetRef}
                      trigger={<ScreenHeader.IconButton type="Add" />}
                    />
                  </>
                }
              />
              {chats && noChats ? (
                <View
                  padding="$xl"
                  margin="$xl"
                  borderRadius="$m"
                  backgroundColor="$positiveBackground"
                  justifyContent="center"
                >
                  <Text fontSize="$l">Welcome to Tlon</Text>
                  <Text fontSize="$s" marginTop="$m">
                    This is Tlon, an app for messaging friends and constructing
                    communities.
                  </Text>
                  <Text fontSize="$s" marginTop="$m">
                    To get started, click the &quot;
                    <Text fontWeight="$xl" fontSize="$l">
                      +
                    </Text>
                    &quot; button above to create a new chat.
                  </Text>
                </View>
              ) : (
                <ChatList data={displayData} onPressItem={onPressChat} />
              )}
              <GroupPreviewSheet
                open={!!selectedGroup}
                onOpenChange={handleGroupPreviewSheetOpenChange}
                group={selectedGroup ?? undefined}
                onActionComplete={handleGroupAction}
              />
              <InviteUsersSheet
                open={inviteSheetGroup !== null}
                onOpenChange={handleInviteSheetOpenChange}
                onInviteComplete={() => setInviteSheetGroup(null)}
                groupId={inviteSheetGroup ?? undefined}
              />
            </View>
          </NavigationProvider>
        </ChatOptionsProvider>
      </RequestsProvider>
    );
  }
);

HomeSidebar.displayName = 'HomeSidebar';
