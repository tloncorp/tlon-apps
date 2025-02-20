import { useIsFocused } from '@react-navigation/native';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
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
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { ChatList } from '../../features/chat-list/ChatList';
import {
  CreateChatSheet,
  CreateChatSheetMethods,
} from '../../features/top/CreateChatSheet';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useFilteredChats } from '../../hooks/useFilteredChats';
import { useGroupActions } from '../../hooks/useGroupActions';
import { identifyTlonEmployee } from '../../utils/posthog';
import { useRootNavigation } from '../utils';

const logger = createDevLogger('HomeSidebar', false);

interface Props {
  previewGroupId?: string;
  focusedChannelId?: string;
}

export function HomeSidebar({ previewGroupId, focusedChannelId }: Props) {
  const screenTitle = 'Home';
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    previewGroupId ?? null
  );
  const { data: selectedGroup } = store.useGroup({ id: selectedGroupId ?? '' });
  const { setIsOpen } = useGlobalSearch();

  const isFocused = useIsFocused();

  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });
  const { performGroupAction } = useGroupActions();

  const connStatus = store.useConnectionStatus();
  const notReadyMessage: string | null = useMemo(() => {
    // if not fully connected yet, show status
    if (connStatus !== 'Connected') {
      return `${connStatus}...`;
    }

    // if still loading the screen data, show loading
    if (!chats || (!chats.unpinned.length && !chats.pinned.length)) {
      return 'Loading...';
    }

    return null;
  }, [connStatus, chats]);

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

  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pending: chats?.pending ?? [],
    };
  }, [chats]);

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
  }, [resolvedChats]);

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

  const displayData = useFilteredChats({
    ...resolvedChats,
    searchQuery: '',
    activeTab: 'home',
  });
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
        onPressInvite={(group) => {
          setInviteSheetGroup(group);
        }}
      >
        <NavigationProvider focusedChannelId={focusedChannelId}>
          <View userSelect="none" flex={1}>
            <ScreenHeader
              title={notReadyMessage ?? screenTitle}
              leftControls={
                <ScreenHeader.IconButton type="Search" onPress={handleSearch} />
              }
              rightControls={
                <CreateChatSheet
                  ref={createChatSheetRef}
                  trigger={<ScreenHeader.IconButton type="Add" />}
                />
              }
            />
            {chats && chats.unpinned.length ? (
              <ChatList data={displayData} onPressItem={onPressChat} />
            ) : null}
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
