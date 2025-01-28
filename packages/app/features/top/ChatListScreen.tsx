import {
  NavigationProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as api from '@tloncorp/shared/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ChatList,
  ChatOptionsProvider,
  GroupPreviewAction,
  GroupPreviewSheet,
  InviteUsersSheet,
  NavBarView,
  NavigationProvider,
  PersonalInviteSheet,
  RequestsProvider,
  ScreenHeader,
  View,
  WelcomeSheet,
  useGlobalSearch,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColorTokens, useTheme } from 'tamagui';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupActions } from '../../hooks/useGroupActions';
import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import { identifyTlonEmployee } from '../../utils/posthog';
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
  const [screenTitle, setScreenTitle] = useState('Home');
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>();
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

  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'messages'>(
    'all'
  );
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
      const dismissed = await db.storage.splashDismissed.getValue();
      setSplashVisible(!dismissed);
    };

    checkSplashDismissed();
  }, []);

  const handleWelcomeOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSplashVisible(false);
      db.storage.splashDismissed.setValue(true);
    }
  }, []);

  const [searchQuery, setSearchQuery] = useState('');

  const isWindowNarrow = useIsWindowNarrow();

  const handleSearchInputToggled = useCallback(() => {
    if (isWindowNarrow) {
      if (showSearchInput) {
        setSearchQuery('');
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
                personalInvite ? (
                  <ScreenHeader.IconButton
                    type="Send"
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
                      // onPress={handlePressAddChat}
                      onPress={() => navigation.navigate('VerifierStub')}
                      // onPress={() => api.getSelfVerificationStatus()}
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
              <ChatList
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                pinned={resolvedChats.pinned}
                unpinned={resolvedChats.unpinned}
                pending={resolvedChats.pending}
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
      />
    </RequestsProvider>
  );
}
