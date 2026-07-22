import {
  NavigationProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashListRef } from '@shopify/flash-list';
import { markInvitesRead } from '@tloncorp/api';
import {
  AnalyticsEvent,
  createDevLogger,
  trackProductEvent,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { Text, YStack } from 'tamagui';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { useChatListSettleTelemetry } from '../../hooks/useChatListSettleTelemetry';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useFilteredChats } from '../../hooks/useFilteredChats';
import { TabName } from '../../hooks/useFilteredChats';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useScrollTabToTop } from '../../hooks/useScrollTabToTop';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useTrackSearchPerformed } from '../../hooks/useTrackSearchPerformed';
import { reportChatListFirstPaint } from '../../lib/chatListSettleTelemetry';
import {
  getChatListTelemetryEntity,
  toHomeTelemetryFilter,
} from '../../lib/featureUsageTelemetry';
import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  GroupPreviewAction,
  GroupPreviewSheet,
  NavBarView,
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
import { ChatListSearch } from '../chat-list/ChatListSearch';
import { ChatListTabs } from '../chat-list/ChatListTabs';
import { CreateChatSheet, CreateChatSheetMethods } from './CreateChatSheet';
import {
  getGroupInviteSheetState,
  isGroupInviteReady,
} from './groupInvitePreview';

const logger = createDevLogger('ChatListScreen', false);

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export default function ChatListScreen(props: Props) {
  const previewGroupId = props.route.params?.previewGroupId;
  const previewGroupFromInviteNotification =
    props.route.params?.previewGroupFromInviteNotification;
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
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [personalInviteOpen, setPersonalInviteOpen] = useState(false);
  const personalInvite = db.personalInviteLink.useValue();
  const { isOpen, setIsOpen } = useGlobalSearch();
  const { scrollRef: chatListRef, onPressActiveTab } =
    useScrollTabToTop<FlashListRef<ChatListItemData>>();

  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    previewGroupId ?? null
  );
  // Tracks a selection opened from a group-invite push notification (distinct from normal pending
  // taps / deep links). Only this case gets the loading/gating/bounded-fallback treatment.
  const [inviteNotificationGroupId, setInviteNotificationGroupId] = useState<
    string | null
  >(previewGroupFromInviteNotification ? previewGroupId ?? null : null);
  const { data: selectedGroup } = store.useGroup({ id: selectedGroupId ?? '' });

  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isFocused = useIsFocused();

  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });
  const { performGroupAction } = useGroupActions();

  const currentUser = useCurrentUserId();

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

  const { navigateToGroup, navigateToChannel } = useRootNavigation();

  const createChatSheetRef = useRef<CreateChatSheetMethods | null>(null);
  const onPressChat = useCallback(
    async (item: db.Chat) => {
      trackProductEvent(AnalyticsEvent.ChatListItemSelected, {
        ...logic.getModelAnalytics(
          item.type === 'group'
            ? { group: item.group }
            : { channel: item.channel }
        ),
        activeFilter: toHomeTelemetryFilter(activeTab),
        entityType: getChatListTelemetryEntity(item),
        isSearchResult: searchQuery.trim() !== '',
        itemState: item.isPending ? 'pending' : 'joined',
        source: 'home_list',
      });
      if (item.type === 'group') {
        if (item.isPending) {
          setSelectedGroupId(item.id);
        } else {
          logger.trackEvent(
            AnalyticsEvent.ActionTappedChat,
            logic.getModelAnalytics({ group: item.group })
          );
          navigateToGroup(item.group.id);
        }
      } else {
        logger.trackEvent(
          AnalyticsEvent.ActionTappedChat,
          logic.getModelAnalytics({ channel: item.channel })
        );
        navigateToChannel(item.channel);
      }
    },
    [activeTab, navigateToGroup, navigateToChannel, searchQuery]
  );

  const handlePressTab = useCallback(
    (tab: TabName) => {
      trackProductEvent(AnalyticsEvent.HomeFilterSelected, {
        tab: toHomeTelemetryFilter(tab),
        previousTab: toHomeTelemetryFilter(activeTab),
        source: 'tap',
        wasAlreadyActive: tab === activeTab,
      });
      setActiveTab(tab);
    },
    [activeTab]
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
            markInvitesRead();
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
        trackProductEvent(AnalyticsEvent.HomeSearchOpened, {
          activeFilter: toHomeTelemetryFilter(activeTab),
          presentation: 'inline',
          source: 'home_header',
        });
      }
      setShowSearchInput(!showSearchInput);
    } else {
      if (!isOpen) {
        trackProductEvent(AnalyticsEvent.HomeSearchOpened, {
          activeFilter: toHomeTelemetryFilter(activeTab),
          presentation: 'global',
          source: 'home_header',
        });
      }
      setIsOpen(!isOpen);
    }
  }, [activeTab, showSearchInput, isWindowNarrow, isOpen, setIsOpen]);

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      performGroupAction(action, group);
      setSelectedGroupId(null);
      setInviteNotificationGroupId(null);
      setWaitElapsedForGroupId(null);
    },
    [performGroupAction]
  );

  const handlePersonalInvitePress = useCallback(() => {
    logger.trackEvent(AnalyticsEvent.PersonalInvitePressed);
    db.hasViewedPersonalInvite.setValue(true);
    setPersonalInviteOpen(true);
  }, []);

  const handlePressTryAll = useCallback(() => {
    trackProductEvent(AnalyticsEvent.HomeFilterSelected, {
      tab: 'all',
      previousTab: toHomeTelemetryFilter(activeTab),
      source: 'empty_search',
      wasAlreadyActive: activeTab === 'home',
    });
    setActiveTab('home');
  }, [activeTab, setActiveTab]);

  const handlePressClear = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const handlePressClose = useCallback(() => {
    handleSearchInputToggled();
  }, [handleSearchInputToggled]);

  const displayData = useFilteredChats({
    ...resolvedChats,
    searchQuery,
    activeTab,
  });
  useTrackSearchPerformed({
    query: searchQuery,
    resultCount: displayData.reduce(
      (count, section) => count + section.data.length,
      0
    ),
    surface: 'home',
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
          <View userSelect="none" flex={1}>
            <ScreenHeader
              title="Home"
              subtitle={syncSubtitle}
              loadingSubtitle={loadingSubtitle}
              showSubtitle={true}
              leftControls={
                personalInvite ? (
                  <ScreenHeader.IconButton
                    type="AddPerson"
                    onPress={handlePersonalInvitePress}
                  />
                ) : undefined
              }
              rightControls={
                <>
                  <ScreenHeader.IconButton
                    type="Search"
                    onPress={handleSearchInputToggled}
                  />
                  {isWindowNarrow ? (
                    <View position="relative" alignItems="flex-end">
                      <ScreenHeader.IconButton
                        type="Add"
                        onPress={handlePressAddChat}
                        testID="CreateChatSheetTrigger"
                        color={
                          isWindowNarrow && showHomeAddTooltip
                            ? '$positiveActionText'
                            : '$primaryText'
                        }
                        backgroundColor={
                          isWindowNarrow && showHomeAddTooltip
                            ? '$positiveBackground'
                            : 'transparent'
                        }
                      />
                      {isWindowNarrow && showHomeAddTooltip && (
                        <WayfindingNotice.HomeAddTooltip />
                      )}
                    </View>
                  ) : (
                    <CreateChatSheet
                      ref={createChatSheetRef}
                      analyticsActiveFilter={toHomeTelemetryFilter(activeTab)}
                      analyticsSource="home_header"
                      trigger={<ScreenHeader.IconButton type="Add" />}
                    />
                  )}
                </>
              }
            />
            {chats &&
            (chats.unpinned.length ||
              chats.pending.length ||
              chats.pinned.length) ? (
              <>
                <ChatListTabs
                  onPressTab={handlePressTab}
                  activeTab={activeTab}
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
                    activeTab={activeTab}
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
        <NavBarView
          navigateToContacts={() => {
            navigation.navigate('Contacts', undefined, { pop: true });
          }}
          navigateToHome={() => {
            navigation.navigate('ChatList', undefined, { pop: true });
          }}
          navigateToNotifications={() => {
            navigation.navigate('Activity', undefined, { pop: true });
          }}
          onPressActiveTab={onPressActiveTab}
          currentRoute="ChatList"
          currentUserId={currentUser}
        />
      </ChatOptionsProvider>

      {isWindowNarrow && (
        <CreateChatSheet
          ref={createChatSheetRef}
          analyticsActiveFilter={toHomeTelemetryFilter(activeTab)}
          analyticsSource="home_header"
        />
      )}
      <PersonalInviteSheet
        open={personalInviteOpen}
        onOpenChange={() => setPersonalInviteOpen(false)}
        onPressInviteFriends={handleInviteFriends}
      />
    </>
  );
}

function SearchResultsEmpty({
  activeTab,
  onPressClear,
  onPressTryAll,
}: {
  activeTab: TabName;
  onPressTryAll: () => void;
  onPressClear: () => void;
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
      {activeTab !== 'home' && (
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
