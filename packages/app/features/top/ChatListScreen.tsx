import {
  NavigationProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import {
  AddGroupSheet,
  ChatList,
  ChatOptionsProvider,
  ChatOptionsSheet,
  ChatOptionsSheetMethods,
  GroupPreviewAction,
  GroupPreviewSheet,
  InviteUsersSheet,
  NavBarView,
  RequestsProvider,
  ScreenHeader,
  View,
  WelcomeSheet,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupActions } from '../../hooks/useGroupActions';
import { useFeatureFlag } from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';
import { screenNameFromChannelId } from '../../navigation/utils';
import { identifyTlonEmployee } from '../../utils/posthog';
import { isSplashDismissed, setSplashDismissed } from '../../utils/splash';

const logger = createDevLogger('ChatListScreen', false);

type Props = NativeStackScreenProps<RootStackParamList, 'ChatList'>;

export default function ChatListScreen(props: Props) {
  const previewGroupId = props.route.params?.previewGroupId;
  return <ChatListScreenView previewGroupId={previewGroupId} />;
}

export function ChatListScreenView({
  previewGroupId,
}: {
  previewGroupId?: string;
}) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [screenTitle, setScreenTitle] = useState('Home');
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>();
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);
  const [longPressedChat, setLongPressedChat] = useState<db.Chat | null>(null);
  const chatOptionsGroupId = useMemo(() => {
    return longPressedChat?.type === 'group'
      ? longPressedChat.group.id
      : undefined;
  }, [longPressedChat]);

  const chatOptionsChannelId = useMemo(() => {
    return longPressedChat?.type === 'channel'
      ? longPressedChat.channel.id
      : undefined;
  }, [longPressedChat]);

  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'messages'>(
    'all'
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    previewGroupId ?? null
  );
  const { data: selectedGroup } = store.useGroup({ id: selectedGroupId ?? '' });

  const [showSearchInput, setShowSearchInput] = useState(false);
  const isFocused = useIsFocused();
  const { data: pins } = store.usePins({
    enabled: isFocused,
  });
  const pinned = useMemo(() => pins ?? [], [pins]);

  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });
  const { performGroupAction } = useGroupActions();

  const currentUser = useCurrentUserId();

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

  const handleNavigateToFindGroups = useCallback(() => {
    setAddGroupOpen(false);
    navigation.navigate('FindGroups');
  }, [navigation]);

  const handleNavigateToCreateGroup = useCallback(() => {
    setAddGroupOpen(false);
    navigation.navigate('CreateGroup');
  }, [navigation]);

  const goToDm = useCallback(
    async (userId: string) => {
      const dmChannel = await store.upsertDmChannel({
        participants: [userId],
      });
      setAddGroupOpen(false);
      navigation.navigate('DM', { channelId: dmChannel.id });
    },
    [navigation, setAddGroupOpen]
  );

  const handleAddGroupOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setAddGroupOpen(false);
    }
  }, []);

  const [isChannelSwitcherEnabled] = useFeatureFlag('channelSwitcher');

  const onPressChat = useCallback(
    (item: db.Chat) => {
      if (item.type === 'group' && item.isPending) {
        setSelectedGroupId(item.id);
      } else if (item.type === 'group' && !isChannelSwitcherEnabled) {
        navigation.navigate('GroupChannels', { groupId: item.group.id });
      } else if (item.type === 'group') {
        if (!item.group.channels?.length) {
          throw new Error('cant open group with no channels');
        }
        navigation.navigate('Channel', {
          channelId: item.group.channels[0].id,
          groupId: item.group.id,
        });
      } else {
        const screenName = screenNameFromChannelId(item.id);
        navigation.navigate(screenName, {
          channelId: item.id,
        });
      }
    },
    [isChannelSwitcherEnabled, navigation]
  );

  const onLongPressChat = useCallback((item: db.Chat) => {
    if (item.isPending) {
      return;
    }

    setLongPressedChat(item);

    if (item.type === 'channel') {
      chatOptionsSheetRef.current?.open(
        item.channel.id,
        item.channel.type,
        item.channel.unread?.count
      );
    } else {
      chatOptionsSheetRef.current?.open(
        item.group.id,
        'group',
        item.group.unread?.count ?? undefined
      );
    }
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

  const handleSectionChange = useCallback(
    (title: string) => {
      if (activeTab === 'all') {
        setScreenTitle(title);
      }
    },
    [activeTab]
  );

  useEffect(() => {
    if (activeTab === 'all') {
      setScreenTitle('Home');
    } else if (activeTab === 'groups') {
      setScreenTitle('Groups');
    } else if (activeTab === 'messages') {
      setScreenTitle('Messages');
    }
  }, [activeTab]);

  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const checkSplashDismissed = async () => {
      const dismissed = await isSplashDismissed();
      setSplashVisible(!dismissed);
    };

    checkSplashDismissed();
  }, []);

  const handleWelcomeOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSplashVisible(false);
      setSplashDismissed();
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchInputToggled = useCallback(() => {
    if (showSearchInput) {
      setSearchQuery('');
    }
    setShowSearchInput(!showSearchInput);
  }, [showSearchInput]);

  const handleGroupAction = useCallback(
    (action: GroupPreviewAction, group: db.Group) => {
      performGroupAction(action, group);
      setSelectedGroupId(null);
    },
    [performGroupAction]
  );

  return (
    <RequestsProvider
      usePostReference={store.usePostReference}
      useChannel={store.useChannelPreview}
      usePost={store.usePostWithRelations}
      useApp={store.useAppInfo}
      useGroup={store.useGroupPreview}
    >
      <ChatOptionsProvider
        channelId={chatOptionsChannelId}
        groupId={chatOptionsGroupId}
        pinned={pinned}
        {...useChatSettingsNavigation()}
        onPressInvite={(group) => {
          setInviteSheetGroup(group);
        }}
      >
        <View flex={1}>
          <ScreenHeader
            title={notReadyMessage ?? screenTitle}
            rightControls={
              <>
                <ScreenHeader.IconButton
                  type="Search"
                  onPress={handleSearchInputToggled}
                />
                <ScreenHeader.IconButton
                  type="Add"
                  onPress={() => setAddGroupOpen(true)}
                />
              </>
            }
          />
          {chats && chats.unpinned.length ? (
            <ChatList
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              pinned={resolvedChats.pinned}
              unpinned={resolvedChats.unpinned}
              pending={resolvedChats.pending}
              onLongPressItem={onLongPressChat}
              onPressItem={onPressChat}
              onSectionChange={handleSectionChange}
              showSearchInput={showSearchInput}
              onSearchToggle={handleSearchInputToggled}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          ) : null}

          <WelcomeSheet
            open={splashVisible}
            onOpenChange={handleWelcomeOpenChange}
          />
          <ChatOptionsSheet ref={chatOptionsSheetRef} />
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
            group={inviteSheetGroup ?? undefined}
          />
        </View>
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

      <AddGroupSheet
        open={addGroupOpen}
        onGoToDm={goToDm}
        onOpenChange={handleAddGroupOpenChange}
        navigateToFindGroups={handleNavigateToFindGroups}
        navigateToCreateGroup={handleNavigateToCreateGroup}
      />
    </RequestsProvider>
  );
}
