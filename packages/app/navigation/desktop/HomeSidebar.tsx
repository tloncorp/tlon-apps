import { useIsFocused } from '@react-navigation/native';
import { markInvitesRead } from '@tloncorp/api';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
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
import {
  getGroupInviteSheetState,
  isGroupInviteReady,
} from '../../features/top/groupInvitePreview';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useFilteredChats } from '../../hooks/useFilteredChats';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useInviteParam } from '../../hooks/useInviteParam';
import { useRenderCount } from '../../hooks/useRenderCount';
import { useResolvedChats } from '../../hooks/useResolvedChats';
import { useShowWebSplashModal } from '../../hooks/useShowWebSplashModal';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import {
  ChatOptionsProvider,
  GroupPreviewAction,
  GroupPreviewSheet,
  InviteUsersSheet,
  MobileAppPromoBanner,
  NavigationProvider,
  RequestsProvider,
  ScreenHeader,
  View,
  useGlobalSearch,
} from '../../ui';
import { SplashModal } from '../../ui/components/Wayfinding/SplashModal';
import { identifyTlonEmployee } from '../../utils/posthog';
import { useRootNavigation } from '../utils';

const logger = createDevLogger('HomeSidebar', false);

interface Props {
  previewGroupId?: string;
  previewGroupFromInviteNotification?: boolean;
  focusedChannelId?: string;
}

export const HomeSidebar = memo(
  ({
    previewGroupId,
    previewGroupFromInviteNotification,
    focusedChannelId,
  }: Props) => {
    const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>();

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
      previewGroupId ?? null
    );
    const [inviteNotificationGroupId, setInviteNotificationGroupId] = useState<
      string | null
    >(previewGroupFromInviteNotification ? previewGroupId ?? null : null);
    const [waitElapsedForGroupId, setWaitElapsedForGroupId] = useState<
      string | null
    >(null);
    const { data: selectedGroup } = store.useGroup({
      id: selectedGroupId ?? '',
    });
    const { setIsOpen } = useGlobalSearch();
    const showSplash = useShowWebSplashModal();

    const { data: chats } = store.useCurrentChats();
    const { performGroupAction } = useGroupActions();

    const connStatus = store.useConnectionStatus();
    const session = store.useCurrentSession();

    const initSyncSettled =
      session?.phase === 'low' || session?.phase === 'ready';
    const syncReadyForInvite = connStatus === 'Connected' && initSyncSettled;
    const awaitingInviteGroupId =
      syncReadyForInvite &&
      selectedGroupId != null &&
      selectedGroupId === inviteNotificationGroupId &&
      !isGroupInviteReady(selectedGroup)
        ? selectedGroupId
        : null;

    useEffect(() => {
      if (awaitingInviteGroupId == null) {
        return;
      }
      const groupId = awaitingInviteGroupId;
      const timeout = setTimeout(
        () => setWaitElapsedForGroupId(groupId),
        15_000
      );
      return () => clearTimeout(timeout);
    }, [awaitingInviteGroupId]);

    const {
      sheetOpen: groupPreviewSheetOpen,
      sheetGroup: groupPreviewSheetGroup,
      shouldCloseUnresolved: groupInviteUnresolved,
    } = getGroupInviteSheetState({
      selectedGroupId,
      selectedGroup,
      inviteNotificationGroupId,
      waitElapsedForGroupId,
    });

    useEffect(() => {
      if (groupInviteUnresolved) {
        logger.trackEvent(AnalyticsEvent.ErrorPushNotifNavigate, {
          context: 'group invite preview never resolved',
        });
        setSelectedGroupId(null);
        setInviteNotificationGroupId(null);
        setWaitElapsedForGroupId(null);
      }
    }, [groupInviteUnresolved]);

    const noChats = useMemo(
      () =>
        chats?.pinned.length === 0 &&
        chats?.unpinned.length === 0 &&
        chats?.pending.length === 0,
      [chats]
    );

    /* Log an error if this screen takes more than 30 seconds to resolve to "Connected" */
    const connectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(
      null
    );
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
            setInviteNotificationGroupId(null);
            setWaitElapsedForGroupId(null);
          } else {
            navigateToGroup(item.group.id);
          }
        } else {
          navigateToChannel(item.channel);
        }
      },
      [navigateToGroup, navigateToChannel]
    );

    const isFocused = useIsFocused();
    useEffect(() => {
      if (isFocused) {
        setTimeout(() => {
          store.syncQueue.add(
            'markInvitesRead',
            { priority: store.SyncPriority.Medium },
            async () => {
              markInvitesRead();
            }
          );
        }, 1000);
      }
    }, [isFocused]);

    useEffect(() => {
      if (previewGroupId) {
        setSelectedGroupId(previewGroupId);
        setInviteNotificationGroupId(
          previewGroupFromInviteNotification ? previewGroupId : null
        );
      }
    }, [previewGroupId, previewGroupFromInviteNotification]);

    const handleGroupPreviewSheetOpenChange = useCallback((open: boolean) => {
      if (!open) {
        setSelectedGroupId(null);
        setInviteNotificationGroupId(null);
        setWaitElapsedForGroupId(null);
      }
    }, []);

    const handleInviteSheetOpenChange = useCallback((open: boolean) => {
      if (!open) {
        setInviteSheetGroup(null);
      }
    }, []);

    const { subtitle: syncSubtitle, loadingSubtitle: syncLoadingSubtitle } =
      useSyncStatus();
    const loadingSubtitle = useMemo(() => {
      if (syncLoadingSubtitle) {
        return syncLoadingSubtitle;
      }
      return chats ? null : 'Loading...';
    }, [syncLoadingSubtitle, chats]);

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
        setInviteNotificationGroupId(null);
        setWaitElapsedForGroupId(null);
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

    useInviteParam();

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
            <View userSelect="none" flex={1} position="relative">
              <ScreenHeader
                title={'Home'}
                subtitle={syncSubtitle}
                loadingSubtitle={loadingSubtitle}
                showSubtitle={true}
                testID="HomeSidebarHeader"
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
              <View flex={1}>
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
                      This is Tlon, an app for messaging friends and
                      constructing communities.
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
                  <ChatList
                    data={displayData}
                    allPinnedChats={resolvedChats.pinned}
                    onPressItem={onPressChat}
                    disableScrollAnchoring
                    scrollerTestID="HomeSidebarChatScroller"
                  />
                )}
              </View>
              <MobileAppPromoBanner />
              <GroupPreviewSheet
                open={groupPreviewSheetOpen}
                onOpenChange={handleGroupPreviewSheetOpenChange}
                group={groupPreviewSheetGroup}
                onActionComplete={handleGroupAction}
              />
              <InviteUsersSheet
                open={inviteSheetGroup !== null}
                onOpenChange={handleInviteSheetOpenChange}
                onInviteComplete={() => setInviteSheetGroup(null)}
                groupId={inviteSheetGroup ?? undefined}
              />
              <SplashModal open={showSplash} setOpen={() => {}} />
            </View>
          </NavigationProvider>
        </ChatOptionsProvider>
      </RequestsProvider>
    );
  }
);

HomeSidebar.displayName = 'HomeSidebar';
