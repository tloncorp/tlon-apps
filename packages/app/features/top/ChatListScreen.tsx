import {
  NavigationProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { ColorTokens, Text, YStack, useTheme } from 'tamagui';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useFilteredChats } from '../../hooks/useFilteredChats';
import { TabName } from '../../hooks/useFilteredChats';
import { useGroupActions } from '../../hooks/useGroupActions';
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
  RequestsProvider,
  ScreenHeader,
  View,
  triggerHaptic,
  useGlobalSearch,
  useIsWindowNarrow,
} from '../../ui';
import SystemNotices from '../../ui/components/SystemNotices';
import { identifyTlonEmployee } from '../../utils/posthog';
import { ChatList } from '../chat-list/ChatList';
import { ChatListSearch } from '../chat-list/ChatListSearch';
import { ChatListTabs } from '../chat-list/ChatListTabs';
import { CreateChatSheet, CreateChatSheetMethods } from './CreateChatSheet';

const logger = createDevLogger('ChatListScreen', false);

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export default function ChatListScreen(props: Props) {
  const previewGroupId = props.route.params?.previewGroupId;
  return <ChatListScreenView previewGroupId={previewGroupId} />;
}

export function ChatListScreenView({
  previewGroupId,
  focusedChannelId,
}: {
  previewGroupId?: string;
  focusedChannelId?: string;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [personalInviteOpen, setPersonalInviteOpen] = useState(false);
  const personalInvite = db.personalInviteLink.useValue();
  const viewedPersonalInvite = db.hasViewedPersonalInvite.useValue();
  const { isOpen, setIsOpen } = useGlobalSearch();
  const theme = useTheme();
  const inviteButtonColor = useMemo(
    () =>
      (viewedPersonalInvite
        ? theme?.primaryText?.val
        : theme?.positiveActionText?.val) as ColorTokens,
    [
      theme?.positiveActionText?.val,
      theme?.primaryText?.val,
      viewedPersonalInvite,
    ]
  );

  const [activeTab, setActiveTab] = useState<TabName>('home');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    previewGroupId ?? null
  );
  const { data: selectedGroup } = store.useGroup({ id: selectedGroupId ?? '' });

  const [showSearchInput, setShowSearchInput] = useState(false);
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
  const isSyncing = store.useIsSyncing();
  const notReadyMessage: string | null = useMemo(() => {
    // if not fully connected yet, show status
    // if (connStatus !== 'Connected') {
    //   return `${connStatus}...`;
    // }

    if (isSyncing) {
      return 'Syncing...';
    }

    // if still loading the screen data, show loading
    if (!chats || (!chats.unpinned.length && !chats.pinned.length)) {
      return 'Loading...';
    }

    return null;
  }, [isSyncing, chats]);

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

  const [searchQuery, setSearchQuery] = useState('');

  const isWindowNarrow = useIsWindowNarrow();

  const handleSearchInputToggled = useCallback(() => {
    if (isWindowNarrow) {
      if (showSearchInput) {
        setSearchQuery('');
        Keyboard.dismiss();
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
    },
    [performGroupAction]
  );

  const handlePersonalInvitePress = useCallback(() => {
    logger.trackEvent(AnalyticsEvent.PersonalInvitePressed);
    db.hasViewedPersonalInvite.setValue(true);
    setPersonalInviteOpen(true);
  }, []);

  const handlePressTryAll = useCallback(() => {
    setActiveTab('home');
  }, [setActiveTab]);

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
              title={notReadyMessage ?? 'Home'}
              leftControls={
                personalInvite ? (
                  <ScreenHeader.IconButton
                    type="AddPerson"
                    color={inviteButtonColor}
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
                    <ScreenHeader.IconButton
                      type="Add"
                      onPress={handlePressAddChat}
                      testID="CreateChatSheetTrigger"
                    />
                  ) : (
                    <CreateChatSheet
                      ref={createChatSheetRef}
                      trigger={<ScreenHeader.IconButton type="Add" />}
                    />
                  )}
                </>
              }
            />
            {chats && chats.unpinned.length ? (
              <>
                <ChatListTabs onPressTab={setActiveTab} activeTab={activeTab} />
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
                  <ChatList data={displayData} onPressItem={onPressChat} />
                )}
              </>
            ) : null}
            <GroupPreviewSheet
              open={!!selectedGroup}
              onOpenChange={handleGroupPreviewSheetOpenChange}
              group={selectedGroup ?? undefined}
              onActionComplete={handleGroupAction}
            />
          </View>
        </NavigationProvider>
        {chats && <SystemNotices.NotificationsPrompt />}
        <NavBarView
          navigateToContacts={() => {
            navigation.navigate('Contacts');
          }}
          navigateToHome={() => {
            navigation.navigate('ChatList');
          }}
          navigateToNotifications={() => {
            navigation.navigate('Activity');
          }}
          currentRoute="ChatList"
          currentUserId={currentUser}
        />
      </ChatOptionsProvider>

      {isWindowNarrow && <CreateChatSheet ref={createChatSheetRef} />}
      <PersonalInviteSheet
        open={personalInviteOpen}
        onOpenChange={() => setPersonalInviteOpen(false)}
        onPressInviteFriends={handleInviteFriends}
      />
    </RequestsProvider>
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
