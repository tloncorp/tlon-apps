import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { TLON_EMPLOYEE_GROUP } from '@tloncorp/app/constants';
import { useCalmSettings } from '@tloncorp/app/hooks/useCalmSettings';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import { useGroupContext } from '@tloncorp/app/hooks/useGroupContext';
import * as featureFlags from '@tloncorp/app/lib/featureFlags';
import { identifyTlonEmployee } from '@tloncorp/app/utils/posthog';
import {
  isSplashDismissed,
  setSplashDismissed,
} from '@tloncorp/app/utils/splash';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  Button,
  CalmProvider,
  ChatList,
  ChatOptionsSheet,
  FloatingActionButton,
  GroupPreviewSheet,
  Icon,
  NavBarView,
  ScreenHeader,
  StartDmSheet,
  View,
  WelcomeSheet,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ContextMenu from 'react-native-context-menu-view';

import AddGroupSheet from '../components/AddGroupSheet';
import { RootStackParamList } from '../types';

type ChatListScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChatList'
>;

const ShowFiltersButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <Button borderWidth={0} onPress={onPress}>
      <Icon type="Filter" size="$m" />
    </Button>
  );
};

export default function ChatListScreen(
  props: ChatListScreenProps & { contacts: db.Contact[] }
) {
  const navigation = useNavigation();
  const [screenTitle, setScreenTitle] = useState('Home');
  const [longPressedChannel, setLongPressedChannel] =
    useState<db.Channel | null>(null);
  const [longPressedGroup, setLongPressedGroup] = useState<db.Group | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'messages'>(
    'all'
  );
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const [startDmOpen, setStartDmOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const isFocused = useIsFocused();
  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });

  const currentUser = useCurrentUserId();

  const { data: contacts } = store.useContacts();
  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pendingChats: chats?.pendingChats ?? [],
    };
  }, [chats]);

  const goToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      setStartDmOpen(false);
      props.navigation.push('Channel', { channel: dmChannel });
    },
    [props.navigation]
  );

  const goToChannel = useCallback(
    ({ channel }: { channel: db.Channel }) => {
      setStartDmOpen(false);
      setAddGroupOpen(false);
      setTimeout(() => props.navigation.navigate('Channel', { channel }), 150);
    },
    [props.navigation]
  );

  const onPressChat = useCallback(
    (item: db.Channel | db.Group) => {
      if (logic.isGroup(item)) {
        setSelectedGroup(item);
      } else if (
        item.group &&
        !featureFlags.isEnabled('channelSwitcher') &&
        // Should navigate to channel if it's pinned as a channel
        (!item.pin || item.pin.type === 'group')
      ) {
        props.navigation.navigate('GroupChannels', { group: item.group });
      } else {
        props.navigation.navigate('Channel', {
          channel: item,
          selectedPostId: item.firstUnreadPostId,
        });
      }
    },
    [props.navigation]
  );

  const onLongPressItem = useCallback((item: db.Channel | db.Group) => {
    // noop for now
    if (logic.isChannel(item)) {
      if (item.pin?.type === 'channel') {
        setLongPressedChannel(item);
      } else if (item.group) {
        setLongPressedGroup(item.group);
      }
    }
  }, []);

  const handleDmOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setStartDmOpen(false);
    }
  }, []);

  const handleAddGroupOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setAddGroupOpen(false);
    }
  }, []);

  const handleGroupPreviewSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedGroup(null);
    }
  }, []);

  const handleChatOptionsOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setLongPressedChannel(null);
        setLongPressedGroup(null);
      }
    },
    [setLongPressedChannel]
  );

  const handleGroupCreated = useCallback(
    ({ channel }: { channel: db.Channel }) => goToChannel({ channel }),
    [goToChannel]
  );

  const handleGoToGroupMeta = useCallback(
    (groupId: string) => {
      // @ts-expect-error TODO fix nested navigator types
      navigation.navigate('GroupSettings', {
        screen: 'GroupMeta',
        params: { groupId },
      });

      setLongPressedGroup(null);
    },
    [navigation]
  );

  const handleGoToGroupMembers = useCallback(
    (groupId: string) => {
      // @ts-expect-error TODO fix nested navigator types
      navigation.navigate('GroupSettings', {
        screen: 'GroupMembers',
        params: { groupId },
      });

      setLongPressedGroup(null);
    },
    [navigation]
  );

  const handleGoToManageChannels = useCallback(
    (groupId: string) => {
      // @ts-expect-error TODO fix nested navigator types
      navigation.navigate('GroupSettings', {
        screen: 'ManageChannels',
        params: { groupId },
      });

      setLongPressedGroup(null);
    },
    [navigation]
  );

  const handleGoToInvitesAndPrivacy = useCallback(
    (groupId: string) => {
      // @ts-expect-error TODO fix nested navigator types
      navigation.navigate('GroupSettings', {
        screen: 'InvitesAndPrivacy',
        params: { groupId },
      });

      setLongPressedGroup(null);
    },
    [navigation]
  );

  const handleGoToRoles = useCallback(
    (groupId: string) => {
      // @ts-expect-error TODO fix nested navigator types
      navigation.navigate('GroupSettings', {
        screen: 'GroupRoles',
        params: { groupId },
      });

      setLongPressedGroup(null);
    },
    [navigation]
  );

  const handleGotoErrorReporter = useCallback(() => {
    props.navigation.navigate('WompWomp');
  }, [props.navigation]);

  const { pinned, unpinned } = resolvedChats;
  const allChats = [...pinned, ...unpinned];
  const isTlonEmployee = !!allChats.find(
    (obj) => obj.groupId === TLON_EMPLOYEE_GROUP
  );
  if (isTlonEmployee && TLON_EMPLOYEE_GROUP !== '') {
    identifyTlonEmployee();
  }

  const { calmSettings } = useCalmSettings();

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

  const { leaveGroup, togglePinned } = useGroupContext({
    groupId: longPressedGroup?.id ?? '',
  });

  const handleLeaveGroup = useCallback(async () => {
    setLongPressedGroup(null);
    leaveGroup();
  }, [leaveGroup]);

  const handleTogglePinned = useCallback(() => {
    togglePinned();
    setLongPressedGroup(null);
  }, [togglePinned]);

  const handleDismissOptionsSheet = useCallback(() => {
    setLongPressedGroup(null);
    setLongPressedChannel(null);
  }, []);

  return (
    <CalmProvider calmSettings={calmSettings}>
      <AppDataContextProvider
        currentUserId={currentUser}
        contacts={contacts ?? []}
      >
        <View backgroundColor="$background" flex={1}>
          <ScreenHeader
            title={
              !chats || (!chats.unpinned.length && !chats.pinned.length)
                ? 'Loading…'
                : screenTitle
            }
            rightControls={
              <ShowFiltersButton
                onPress={() => setShowFilters((prev) => !prev)}
              />
            }
          />
          {chats && chats.unpinned.length ? (
            <ChatList
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              pinned={resolvedChats.pinned}
              unpinned={resolvedChats.unpinned}
              pendingChats={resolvedChats.pendingChats}
              onLongPressItem={onLongPressItem}
              onPressItem={onPressChat}
              onSectionChange={handleSectionChange}
              showFilters={showFilters}
            />
          ) : null}
          <View
            zIndex={50}
            position="absolute"
            bottom="$s"
            alignItems="center"
            width={'100%'}
            pointerEvents="box-none"
          >
            <ContextMenu
              dropdownMenuMode={true}
              actions={[
                { title: 'Create or join a group' },
                { title: 'Start a direct message' },
              ]}
              onPress={(event) => {
                const { index } = event.nativeEvent;
                if (index === 0) {
                  setAddGroupOpen(true);
                }
                if (index === 1) {
                  setStartDmOpen(true);
                }
              }}
            >
              <FloatingActionButton
                icon={<Icon type="Add" size="$s" marginRight="$s" />}
                label={'Add'}
                onPress={() => {}}
              />
            </ContextMenu>
          </View>
          <WelcomeSheet
            open={splashVisible}
            onOpenChange={handleWelcomeOpenChange}
          />
          <ChatOptionsSheet
            open={longPressedChannel !== null || longPressedGroup !== null}
            onOpenChange={handleChatOptionsOpenChange}
            currentUser={currentUser}
            pinned={pinned}
            channel={longPressedChannel ?? undefined}
            group={longPressedGroup ?? undefined}
            useGroup={store.useGroup}
            onPressGroupMeta={handleGoToGroupMeta}
            onPressGroupMembers={handleGoToGroupMembers}
            onPressManageChannels={handleGoToManageChannels}
            onPressInvitesAndPrivacy={handleGoToInvitesAndPrivacy}
            onPressRoles={handleGoToRoles}
            onPressLeave={handleLeaveGroup}
            onTogglePinned={handleTogglePinned}
          />
          <StartDmSheet
            goToDm={goToDm}
            open={startDmOpen}
            onOpenChange={handleDmOpenChange}
          />
          <AddGroupSheet
            open={addGroupOpen}
            onOpenChange={handleAddGroupOpenChange}
            onCreatedGroup={handleGroupCreated}
          />
          <GroupPreviewSheet
            open={selectedGroup !== null}
            onOpenChange={handleGroupPreviewSheetOpenChange}
            group={selectedGroup ?? undefined}
          />
        </View>
        <NavBarView
          navigateToHome={() => {
            props.navigation.navigate('ChatList');
          }}
          navigateToNotifications={() => {
            props.navigation.navigate('Activity');
          }}
          navigateToProfile={() => {
            props.navigation.navigate('Profile');
          }}
          currentRoute="ChatList"
        />
      </AppDataContextProvider>
    </CalmProvider>
  );
}
