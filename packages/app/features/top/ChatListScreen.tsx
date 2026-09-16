import { RouteProp, useIsFocused, useRoute } from '@react-navigation/native';
import { FlashListRef } from '@shopify/flash-list';
import { markInvitesRead, reportBackgroundFailure } from '@tloncorp/api';
import { AnalyticsEvent, createDevLogger, trackEvent } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { Text, YStack, isWeb } from 'tamagui';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { useChatListSettleTelemetry } from '../../hooks/useChatListSettleTelemetry';
import { useBotDmTab } from '../../hooks/useBotDmTab';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import type { ChatListFilter } from '../../hooks/chatListFilters';
import { useFilteredChats } from '../../hooks/useFilteredChats';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useScrollToTabTop } from '../../hooks/useScrollToTabTop';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { reportChatListFirstPaint } from '../../lib/chatListSettleTelemetry';
import { useFloatingHeaderHeight } from '../../navigation/useFloatingHeaderHeight';
import type { TopLevelTabParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  GroupPreviewAction,
  GroupPreviewSheet,
  NavigationProvider,
  PersonalInviteSheet,
  Pressable,
  ScreenHeader,
  View,
  triggerHaptic,
  useGlobalSearch,
  useIsWindowNarrow,
} from '../../ui';
import SystemNotices from '../../ui/components/SystemNotices';
import WayfindingNotice from '../../ui/components/Wayfinding/Notices';
import { identifyTlonEmployee } from '../../utils/posthog';
import { ChatList, ChatListItemData } from '../chat-list/ChatList';
import { ChatListFilterTabs } from '../chat-list/ChatListFilterTabs';
import { ChatListSearch } from '../chat-list/ChatListSearch';
import { CreateChatSheet, CreateChatSheetMethods } from './CreateChatSheet';
import { useAgentOnboardingLandingConsumer } from './useAgentOnboardingLandingConsumer';
import {
  getGroupInviteSheetState,
  isGroupInviteReady,
} from './groupInvitePreview';

const logger = createDevLogger('ChatListScreen', false);

// Workspaces always shows the combined DM + group list. The filter is kept as
// a named constant because analytics and `useFilteredChats` still take a tab.
const COMBINED_CHAT_TAB = 'home' as const;

export default function ChatListScreen() {
  const route = useRoute<RouteProp<TopLevelTabParamList, 'ChatList'>>();
  const previewGroupId = route.params?.previewGroupId;
  const previewGroupFromInviteNotification =
    route.params?.previewGroupFromInviteNotification;
  return (
    <ChatListScreenView
      previewGroupId={previewGroupId}
      previewGroupFromInviteNotification={previewGroupFromInviteNotification}
    />
  );
}

export function ChatListScreenView({
  previewGroupId,
  previewGroupFromInviteNotification,
  focusedChannelId,
}: {
  previewGroupId?: string;
  previewGroupFromInviteNotification?: boolean;
  focusedChannelId?: string;
}) {
  const { navigation, navigateToGroup, navigateToChannel } =
    useRootNavigation();
  const [personalInviteOpen, setPersonalInviteOpen] = useState(false);
  const personalInvite = db.personalInviteLink.useValue();
  const { isOpen, setIsOpen } = useGlobalSearch();
  const chatListRef = useScrollToTabTop<FlashListRef<ChatListItemData>>();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    previewGroupId ?? null
  );
  // Tracks a selection opened from a group-invite push notification (distinct from normal pending
  // taps / deep links). Only this case gets the loading/gating/bounded-fallback treatment.
  const [inviteNotificationGroupId, setInviteNotificationGroupId] = useState<
    string | null
  >(previewGroupFromInviteNotification ? (previewGroupId ?? null) : null);
  const { data: selectedGroup } = store.useGroup({ id: selectedGroupId ?? '' });

  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isFocused = useIsFocused();

  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });

  useAgentOnboardingLandingConsumer();
  const { performGroupAction } = useGroupActions();

  const handleInviteFriends = useCallback(() => {
    setPersonalInviteOpen(false);
    triggerHaptic('baseButtonClick');
    setTimeout(() => {
      navigation.navigate('InviteSystemContacts');
    }, 200);
  }, [navigation]);

  const handlePressInvite = useCallback(
    (groupId: string) => {
      navigation.navigate('InviteUsers', { groupId });
    },
    [navigation]
  );

  const connStatus = store.useConnectionStatus();
  const session = store.useCurrentSession();
  // The bot DM badges itself on the first tab; the bell counts what is
  // happening everywhere else, so one message never lights both.
  const botDm = useBotDmTab();
  const unseenActivityCount = store.useUnreadUnseenActivityCount({
    excludeChannelId: botDm.enabled ? botDm.channelId : undefined,
  });
  const haveUnreadActivity = unseenActivityCount > 0;

  // React to a later `previewGroupId` param (e.g. a notification tap while ChatList is already
  // mounted), mirroring desktop HomeSidebar. Also (re)marks whether the selection came from a
  // group-invite notification.
  useEffect(() => {
    if (previewGroupId) {
      setSelectedGroupId(previewGroupId);
      setInviteNotificationGroupId(
        previewGroupFromInviteNotification ? previewGroupId : null
      );
    }
  }, [previewGroupId, previewGroupFromInviteNotification]);

  // Bounded fallback timer for a notification-opened invite whose local row hasn't landed yet.
  // Group-keyed (a second invite gets a fresh full window) and sync-readiness-gated: the window
  // only counts once the channel is connected AND high-priority init/foreigns has had its chance
  // (phase advanced past 'high'), so cold-start/first-sync latency never burns it.
  const [waitElapsedForGroupId, setWaitElapsedForGroupId] = useState<
    string | null
  >(null);
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
    const timeout = setTimeout(() => setWaitElapsedForGroupId(groupId), 15_000);
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

  // Terminal: the bounded window elapsed for a notification invite and it never resolved to a real
  // invite. Close + log rather than degrade into generic group-preview actions.
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

  const { subtitle: syncSubtitle, loadingSubtitle: syncLoadingSubtitle } =
    useSyncStatus();
  const loadingSubtitle = useMemo(() => {
    const haveChats = !!chats?.pinned.length || !!chats?.unpinned.length;
    if (
      syncLoadingSubtitle &&
      (!haveChats || syncLoadingSubtitle?.toLowerCase().includes('sync'))
    ) {
      return syncLoadingSubtitle;
    }
    return chats ? null : 'Loading...';
  }, [syncLoadingSubtitle, chats]);

  /* Log an error if this screen takes more than 30 seconds to resolve to "Connected" */
  const connectionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const createChatSheetRef = useRef<CreateChatSheetMethods | null>(null);
  const onPressChat = useCallback(
    async (item: db.Chat) => {
      if (item.type === 'group') {
        if (item.isPending) {
          setSelectedGroupId(item.id);
        } else {
          logger.trackEvent(AnalyticsEvent.ActionTappedChat, {
            ...logic.getModelAnalytics({ group: item.group }),
            source: searchQuery.trim() ? 'home_search' : 'chat_list',
          });
          navigateToGroup(item.group.id);
        }
      } else {
        logger.trackEvent(AnalyticsEvent.ActionTappedChat, {
          ...logic.getModelAnalytics({ channel: item.channel }),
          source: searchQuery.trim() ? 'home_search' : 'chat_list',
        });
        navigateToChannel(item.channel);
      }
    },
    [navigateToGroup, navigateToChannel, searchQuery]
  );

  const handlePressAddChat = useCallback(() => {
    // Close the filter input (and its keyboard) before opening the sheet so
    // the keyboard can't overlap it and trap touches (TLON-6187).
    if (showSearchInput) {
      setSearchQuery('');
      setShowSearchInput(false);
      Keyboard.dismiss();
    }
    db.wayfindingProgress.setValue((prev) => ({
      ...prev,
      tappedHomeAdd: true,
    }));
    createChatSheetRef.current?.open();
  }, [showSearchInput]);

  const handleGroupPreviewSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedGroupId(null);
      setInviteNotificationGroupId(null);
      setWaitElapsedForGroupId(null);
    }
  }, []);

  const isTlonEmployee = useMemo(() => {
    const allChats = [...resolvedChats.pinned, ...resolvedChats.unpinned];
    return !!allChats.find(
      (chat) => chat.type === 'group' && chat.group.id === TLON_EMPLOYEE_GROUP
    );
  }, [resolvedChats]);

  useEffect(() => {
    if (isFocused) {
      setTimeout(() => {
        store.syncQueue.add(
          'markInvitesRead',
          { priority: store.SyncPriority.Medium },
          async () => {
            // left unawaited so the queue thread isn't held for the backoff
            markInvitesRead().catch(
              reportBackgroundFailure(logger, 'mark invites read')
            );
          }
        );
      }, 1000);
    }
  }, [isFocused]);

  useChatListSettleTelemetry({ chats, isFocused });

  useEffect(() => {
    if (isTlonEmployee && TLON_EMPLOYEE_GROUP !== '') {
      identifyTlonEmployee();
    }
  }, [isTlonEmployee]);

  const isWindowNarrow = useIsWindowNarrow();
  const showHomeAddTooltip = store.useShowHomeAddTooltip();

  const handleSearchInputToggled = useCallback(() => {
    if (isWindowNarrow) {
      if (showSearchInput) {
        setSearchQuery('');
        Keyboard.dismiss();
      }
      if (!showSearchInput) {
        trackEvent(AnalyticsEvent.HomeSearchOpened, {
          tab: COMBINED_CHAT_TAB,
        });
      }
      setShowSearchInput(!showSearchInput);
    } else {
      setIsOpen(!isOpen);
    }
  }, [showSearchInput, isWindowNarrow, isOpen, setIsOpen]);

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      performGroupAction(action, group);
      setSelectedGroupId(null);
      setInviteNotificationGroupId(null);
      setWaitElapsedForGroupId(null);
    },
    [performGroupAction]
  );

  const handlePressActivity = useCallback(() => {
    navigation.navigate('Activity', undefined, { pop: true });
  }, [navigation]);

  const handlePersonalInvitePress = useCallback(() => {
    logger.trackEvent(AnalyticsEvent.PersonalInvitePressed);
    db.hasViewedPersonalInvite.setValue(true);
    setPersonalInviteOpen(true);
  }, []);

  const handlePressClear = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const handlePressClose = useCallback(() => {
    handleSearchInputToggled();
  }, [handleSearchInputToggled]);

  const [listFilter, setListFilter] = useState<ChatListFilter>('all');
  // The native header floats over the screen on iOS 26, and this screen's
  // content starts at the top of that area. The filter tabs sit above the
  // list, so the clearance has to be layout on the column rather than a
  // scroll inset on the list — nothing here scrolls under the header.
  const headerClearance = useFloatingHeaderHeight();
  const handlePressFilter = useCallback(
    (filter: ChatListFilter) => {
      if (filter === listFilter) return;
      trackEvent(AnalyticsEvent.HomeFilterSelected, { tab: filter });
      setListFilter(filter);
    },
    [listFilter]
  );
  const handlePressTryAll = useCallback(() => {
    trackEvent(AnalyticsEvent.HomeFilterSelected, { tab: 'all' });
    setListFilter('all');
  }, []);

  const displayData = useFilteredChats({
    ...resolvedChats,
    searchQuery,
    activeTab: COMBINED_CHAT_TAB,
    listFilter,
  });
  const handleChatListLoad = useCallback(() => {
    if (chats) {
      reportChatListFirstPaint();
    }
  }, [chats]);

  return (
    <>
      <ChatOptionsProvider
        {...useChatSettingsNavigation()}
        onPressInvite={handlePressInvite}
      >
        <NavigationProvider focusedChannelId={focusedChannelId}>
          <View userSelect="none" flex={1} paddingTop={headerClearance}>
            {showHomeAddTooltip && (
              // Absolute, so the column's padding does not move it: it has
              // to clear the floating header itself to sit under the + it
              // points at.
              <WayfindingNotice.HomeAddTooltip
                top={isWeb ? 36 : headerClearance + 8}
              />
            )}
            <ScreenHeader
              title="Workspaces"
              subtitle={syncSubtitle}
              loadingSubtitle={loadingSubtitle}
              showSubtitle={true}
              leftActions={[
                {
                  id: 'activity',
                  icon: 'Notifications',
                  label: 'Activity',
                  testID: 'ActivityHeaderButton',
                  onPress: handlePressActivity,
                  tint: haveUnreadActivity ? '$blue' : undefined,
                  badge: haveUnreadActivity ? unseenActivityCount : undefined,
                },
                {
                  id: 'invite-people',
                  icon: 'AddPerson',
                  label: 'Invite people',
                  onPress: handlePersonalInvitePress,
                  visible: !!personalInvite,
                },
              ]}
              rightActions={[
                {
                  id: 'search',
                  icon: 'Search',
                  label: 'Search',
                  onPress: handleSearchInputToggled,
                },
                {
                  id: 'add-chat',
                  icon: 'Add',
                  label: 'Add a chat',
                  onPress: handlePressAddChat,
                  testID: 'CreateChatSheetTrigger',
                  tint: showHomeAddTooltip ? '$positiveActionText' : undefined,
                  backgroundTint: showHomeAddTooltip
                    ? '$positiveBackground'
                    : undefined,
                },
              ]}
              placement="navigation"
            />
            {chats &&
            (chats.unpinned.length ||
              chats.pending.length ||
              chats.pinned.length) ? (
              <>
                <ChatListFilterTabs
                  activeFilter={listFilter}
                  onPressFilter={handlePressFilter}
                />
                <ChatListSearch
                  query={searchQuery}
                  onQueryChange={setSearchQuery}
                  isOpen={showSearchInput}
                  onPressClear={handlePressClear}
                  onPressClose={handlePressClose}
                />
                {searchQuery !== '' && !displayData[0]?.data.length ? (
                  <SearchResultsEmpty
                    activeFilter={listFilter}
                    onPressClear={handlePressClear}
                    onPressTryAll={handlePressTryAll}
                  />
                ) : (
                  <ChatList
                    data={displayData}
                    allPinnedChats={resolvedChats.pinned}
                    onPressItem={onPressChat}
                    onLoad={handleChatListLoad}
                    scrollRef={chatListRef}
                  />
                )}
              </>
            ) : null}
            <GroupPreviewSheet
              open={groupPreviewSheetOpen}
              onOpenChange={handleGroupPreviewSheetOpenChange}
              group={groupPreviewSheetGroup}
              onActionComplete={handleGroupAction}
            />
          </View>
        </NavigationProvider>
        {displayData && <SystemNotices.NotificationsPrompt />}
      </ChatOptionsProvider>

      <CreateChatSheet ref={createChatSheetRef} />
      <PersonalInviteSheet
        open={personalInviteOpen}
        onOpenChange={() => setPersonalInviteOpen(false)}
        onPressInviteFriends={handleInviteFriends}
      />
    </>
  );
}

function SearchResultsEmpty({
  activeFilter,
  onPressClear,
  onPressTryAll,
}: {
  activeFilter: ChatListFilter;
  onPressClear: () => void;
  onPressTryAll: () => void;
}) {
  return (
    <YStack
      gap="$l"
      alignItems="center"
      justifyContent="center"
      paddingHorizontal="$l"
      paddingVertical="$m"
    >
      <Text>No results found.</Text>
      {activeFilter !== 'all' && (
        <Pressable onPress={onPressTryAll}>
          <Text textDecorationLine="underline">Try in All?</Text>
        </Pressable>
      )}
      <Pressable onPress={onPressClear}>
        <Text color="$positiveActionText">Clear search</Text>
      </Pressable>
    </YStack>
  );
}
