import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import { isDmChannelId, isGroupDmChannelId } from '@tloncorp/shared/dist/logic';
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
  ScreenHeader,
  StartDmSheet,
  View,
  WelcomeSheet,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// import ContextMenu from 'react-native-context-menu-view';
import { useLocation, useNavigate } from 'react-router';

import useFocusEffect from '@/hooks/useFocusEffect';
import useIsFocused from '@/hooks/useIsFocused';

// import AddGroupSheet from '../components/AddGroupSheet';
// import { TLON_EMPLOYEE_GROUP } from '../constants';
import { useCalmSettings } from '../hooks/useCalmSettings';
import { useCurrentUserId } from '../hooks/useCurrentUser';
import * as featureFlags from '../lib/featureFlags';
import NavBar from '../navigation/NavBarView';
// import { RootStackParamList } from '../types';
// import { identifyTlonEmployee } from '../utils/posthog';
// import { isSplashDismissed, setSplashDismissed } from '../utils/splash';
import { useGroupContext } from './GroupSettings/useGroupContext';

// type ChatListScreenProps = NativeStackScreenProps<
// RootStackParamList,
// 'ChatList'
// >;

const ShowFiltersButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <Button borderWidth={0} onPress={onPress}>
      <Icon type="Filter" size="$m" />
    </Button>
  );
};

export default function ChatListScreen() {
  // const navigation = useNavigation();
  const navigate = useNavigate();
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

  const isInitialFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (!isInitialFocus) {
        store.syncPinnedItems({ priority: store.SyncPriority.High });
      }
      isInitialFocus.current = false;
    }, [])
  );

  const goToDm = useCallback(
    async (participants: string[]) => {
      const dmChannel = await store.upsertDmChannel({
        participants,
      });
      setStartDmOpen(false);
      navigate('/dm/' + dmChannel.id);
    },
    [navigate]
  );

  const goToChannel = useCallback(
    ({ channel }: { channel: db.Channel }) => {
      setStartDmOpen(false);
      setAddGroupOpen(false);
      setTimeout(
        () => navigate('/group/' + channel.groupId + '/channel/' + channel.id),
        150
      );
    },
    [navigate]
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
        // props.navigation.navigate('GroupChannels', { group: item.group });
        navigate('/group/' + item.group.id);
      } else {
        // props.navigation.navigate('Channel', {
        // channel: item,
        // selectedPostId: item.firstUnreadPostId,
        // });

        if (isDmChannelId(item.id) || isGroupDmChannelId(item.id)) {
          navigate('/dm/' + item.id);
        } else {
          navigate('/group/' + item.groupId + '/channel/' + item.id);
        }
      }
    },
    [navigate, setSelectedGroup]
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
      // navigation.navigate('GroupSettings', {
      // screen: 'GroupMeta',
      // params: { groupId },
      // });

      navigate('/groupsettings/' + groupId);

      setLongPressedGroup(null);
    },
    [navigate]
  );

  const handleGoToGroupMembers = useCallback(
    (groupId: string) => {
      // navigation.navigate('GroupSettings', {
      // screen: 'GroupMembers',
      // params: { groupId },
      // });
      navigate('/groupmembers/' + groupId);

      setLongPressedGroup(null);
    },
    [navigate]
  );

  const handleGoToManageChannels = useCallback(
    (groupId: string) => {
      // navigation.navigate('GroupSettings', {
      // screen: 'ManageChannels',
      // params: { groupId },
      // });

      navigate('/managechannels/' + groupId);

      setLongPressedGroup(null);
    },
    [navigate]
  );

  const handleGoToInvitesAndPrivacy = useCallback(
    (groupId: string) => {
      // navigation.navigate('GroupSettings', {
      // screen: 'InvitesAndPrivacy',
      // params: { groupId },
      // });

      navigate('/invitesandprivacy/' + groupId);

      setLongPressedGroup(null);
    },
    [navigate]
  );

  const handleGoToRoles = useCallback(
    (groupId: string) => {
      // navigation.navigate('GroupSettings', {
      // screen: 'GroupRoles',
      // params: { groupId },
      // });

      navigate('/grouproles/' + groupId);

      setLongPressedGroup(null);
    },
    [navigate]
  );

  const { pinned, unpinned } = resolvedChats;
  // const allChats = [...pinned, ...unpinned];
  // const isTlonEmployee = !!allChats.find(
  // (obj) => obj.groupId === TLON_EMPLOYEE_GROUP
  // );
  // if (isTlonEmployee && TLON_EMPLOYEE_GROUP !== '') {
  // identifyTlonEmployee();
  // }

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

  // const [splashVisible, setSplashVisible] = useState(true);

  // useEffect(() => {
  // const checkSplashDismissed = async () => {
  // const dismissed = await isSplashDismissed();
  // setSplashVisible(!dismissed);
  // };

  // checkSplashDismissed();
  // }, []);

  // const handleWelcomeOpenChange = useCallback((open: boolean) => {
  // if (!open) {
  // setSplashVisible(false);
  // // setSplashDismissed();
  // }
  // }, []);

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
            <FloatingActionButton
              icon={<Icon type="Add" size="$s" marginRight="$s" />}
              label={'Add'}
              onPress={() => {}}
            />
          </View>
          {/*
          <WelcomeSheet
            open={splashVisible}
            onOpenChange={handleWelcomeOpenChange}
          />
          */}
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
          {/*
          <StartDmSheet
            goToDm={goToDm}
            open={startDmOpen}
            onOpenChange={handleDmOpenChange}
          />
          {/*
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
          */}
        </View>
        <NavBar />
      </AppDataContextProvider>
    </CalmProvider>
  );
}
