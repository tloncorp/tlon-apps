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
  ScreenHeader,
  StartDmSheet,
  View,
  WelcomeSheet,
} from '@tloncorp/ui';
import { NavBarView } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ContextMenu from 'react-native-context-menu-view';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { useCalmSettings } from '../../hooks/useCalmSettings';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import { useIsFocused } from '../../hooks/useIsFocused';
import * as featureFlags from '../../lib/featureFlags';
import { identifyTlonEmployee } from '../../utils/posthog';
import { isSplashDismissed, setSplashDismissed } from '../../utils/splash';

const ShowFiltersButton = ({ onPress }: { onPress: () => void }) => {
  return (
    <Button borderWidth={0} onPress={onPress}>
      <Icon type="Filter" size="$m" />
    </Button>
  );
};

export default function ChatListScreen({
  navigateToDm,
  navigateToGroupChannels,
  navigateToSelectedPost,
  navigateToGroupMeta,
  navigateToGroupMembers,
  navigateToManageChannels,
  navigateToInvitesAndPrivacy,
  navigateToRoles,
  navigateToHome,
  navigateToNotifications,
  navigateToProfile,
  setAddGroupOpen,
  startDmOpen,
  setStartDmOpen,
}: {
  navigateToDm: (channel: db.Channel) => void;
  navigateToGroupChannels: (group: db.Group) => void;
  navigateToSelectedPost: (channel: db.Channel, postId?: string | null) => void;
  navigateToGroupMeta: (groupId: string) => void;
  navigateToGroupMembers: (groupId: string) => void;
  navigateToManageChannels: (groupId: string) => void;
  navigateToInvitesAndPrivacy: (groupId: string) => void;
  navigateToRoles: (groupId: string) => void;
  navigateToErrorReporter: () => void;
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToProfile: () => void;
  setAddGroupOpen: (open: boolean) => void;
  startDmOpen: boolean;
  setStartDmOpen: (open: boolean) => void;
}) {
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
      navigateToDm(dmChannel);
    },
    [navigateToDm, setStartDmOpen]
  );

  // const goToChannel = useCallback(
  // ({ channel }: { channel: db.Channel }) => {
  // setStartDmOpen(false);
  // // setAddGroupOpen(false);
  // setTimeout(() => navigateToChannel(channel), 150);
  // },
  // [navigateToChannel]
  // );

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
        navigateToGroupChannels(item.group);
      } else {
        navigateToSelectedPost(item, item.firstUnreadPostId);
      }
    },
    [navigateToGroupChannels, navigateToSelectedPost]
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

  const handleDmOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setStartDmOpen(false);
      }
    },
    [setStartDmOpen]
  );

  // const handleAddGroupOpenChange = useCallback((open: boolean) => {
  // if (!open) {
  // setAddGroupOpen(false);
  // }
  // }, []);

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

  // const handleGroupCreated = useCallback(
  // ({ channel }: { channel: db.Channel }) => goToChannel({ channel }),
  // [goToChannel]
  // );

  const handleGoToGroupMeta = useCallback(
    (groupId: string) => {
      navigateToGroupMeta(groupId);

      setLongPressedGroup(null);
    },
    [navigateToGroupMeta]
  );

  const handleGoToGroupMembers = useCallback(
    (groupId: string) => {
      navigateToGroupMembers(groupId);

      setLongPressedGroup(null);
    },
    [navigateToGroupMembers]
  );

  const handleGoToManageChannels = useCallback(
    (groupId: string) => {
      navigateToManageChannels(groupId);

      setLongPressedGroup(null);
    },
    [navigateToManageChannels]
  );

  const handleGoToInvitesAndPrivacy = useCallback(
    (groupId: string) => {
      navigateToInvitesAndPrivacy(groupId);
      setLongPressedGroup(null);
    },
    [navigateToInvitesAndPrivacy]
  );

  const handleGoToRoles = useCallback(
    (groupId: string) => {
      navigateToRoles(groupId);

      setLongPressedGroup(null);
    },
    [navigateToRoles]
  );

  // const handleGotoErrorReporter = useCallback(() => {
  // navigateToErrorReporter();
  // }, [navigateToErrorReporter]);

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
          <GroupPreviewSheet
            open={selectedGroup !== null}
            onOpenChange={handleGroupPreviewSheetOpenChange}
            group={selectedGroup ?? undefined}
          />
        </View>
        <NavBarView
          navigateToHome={navigateToHome}
          navigateToNotifications={navigateToNotifications}
          navigateToProfile={navigateToProfile}
          currentRoute="ChatList"
        />
      </AppDataContextProvider>
    </CalmProvider>
  );
}
