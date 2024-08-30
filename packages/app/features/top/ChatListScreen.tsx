import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  Button,
  CalmProvider,
  ChatList,
  ChatOptionsProvider,
  ChatOptionsSheet,
  ChatOptionsSheetMethods,
  FloatingAddButton,
  GroupPreviewSheet,
  Icon,
  InviteUsersSheet,
  NavBarView,
  RequestsProvider,
  ScreenHeader,
  StartDmSheet,
  View,
  WelcomeSheet,
  useChatOptionsContextValue,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TLON_EMPLOYEE_GROUP } from '../../constants';
import { useCalmSettings } from '../../hooks/useCalmSettings';
import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useIsFocused } from '../../hooks/useIsFocused';
import { useFeatureFlag } from '../../lib/featureFlags';
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
  startDmOpen,
  setStartDmOpen,
  setAddGroupOpen,
  navigateToDm,
  navigateToGroupChannels,
  navigateToSelectedPost,
  navigateToHome,
  navigateToNotifications,
  navigateToProfile,
  branchDomain,
  branchKey,
}: {
  startDmOpen: boolean;
  setStartDmOpen: (open: boolean) => void;
  setAddGroupOpen: (open: boolean) => void;
  navigateToDm: (channel: db.Channel) => void;
  navigateToGroupChannels: (group: db.Group) => void;
  navigateToSelectedPost: (channel: db.Channel, postId?: string | null) => void;
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToProfile: () => void;
  branchDomain: string;
  branchKey: string;
}) {
  const [screenTitle, setScreenTitle] = useState('Home');
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>();
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);
  const [longPressedChat, setLongPressedChat] = useState<
    db.Channel | db.Group | null
  >(null);
  const chatOptionsGroupId = useMemo(() => {
    if (!longPressedChat) {
      return;
    }
    return logic.isGroup(longPressedChat)
      ? longPressedChat.id
      : longPressedChat.group?.id;
  }, [longPressedChat]);

  const chatOptionsChannelId = useMemo(() => {
    if (!longPressedChat || logic.isGroup(longPressedChat)) {
      return;
    }
    return longPressedChat.id;
  }, [longPressedChat]);

  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'messages'>(
    'all'
  );
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const isFocused = useIsFocused();
  const { data: pins } = store.usePins({
    enabled: isFocused,
  });
  const pinned = useMemo(() => pins ?? [], [pins]);
  const { data: pendingChats } = store.usePendingChats({
    enabled: isFocused,
  });
  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });

  const currentUser = useCurrentUserId();

  const { data: contacts } = store.useContacts();
  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pendingChats: pendingChats ?? [],
    };
  }, [chats, pendingChats]);

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

  const [isChannelSwitcherEnabled] = useFeatureFlag('channelSwitcher');

  const onPressChat = useCallback(
    (item: db.Channel | db.Group) => {
      if (logic.isGroup(item)) {
        setSelectedGroup(item);
      } else if (
        item.group &&
        !isChannelSwitcherEnabled &&
        // Should navigate to channel if it's pinned as a channel
        (!item.pin || item.pin.type === 'group')
      ) {
        navigateToGroupChannels(item.group);
      } else {
        navigateToSelectedPost(item, item.firstUnreadPostId);
      }
    },
    [navigateToGroupChannels, navigateToSelectedPost, isChannelSwitcherEnabled]
  );

  const onLongPressChat = useCallback((item: db.Channel | db.Group) => {
    if (logic.isChannel(item) && !item.isDmInvite) {
      setLongPressedChat(item);
      if (item.pin?.type === 'channel' || !item.group) {
        chatOptionsSheetRef.current?.open(item.id, item.type);
      } else {
        chatOptionsSheetRef.current?.open(item.group.id, 'group');
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

  const handleGroupPreviewSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setSelectedGroup(null);
    }
  }, []);

  const handleInviteSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setInviteSheetGroup(null);
    }
  }, []);

  const { pinned: pinnedChats, unpinned } = resolvedChats;
  const allChats = [...pinnedChats, ...unpinned];
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

  const headerControls = useMemo(() => {
    return (
      <ShowFiltersButton onPress={() => setShowFilters((prev) => !prev)} />
    );
  }, []);

  const chatOptionsContext = useChatOptionsContextValue({
    channelId: chatOptionsChannelId,
    groupId: chatOptionsGroupId,
    pinned,
    ...useChatSettingsNavigation(),
  });

  return (
    <CalmProvider calmSettings={calmSettings}>
      <AppDataContextProvider
        currentUserId={currentUser}
        contacts={contacts ?? []}
        branchKey={branchKey}
        branchDomain={branchDomain}
      >
        <RequestsProvider
          usePostReference={store.usePostReference}
          useChannel={store.useChannelWithRelations}
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
                title={
                  !chats || (!chats.unpinned.length && !chats.pinned.length)
                    ? 'Loading…'
                    : screenTitle
                }
                rightControls={headerControls}
              />
              {chats && chats.unpinned.length ? (
                <ChatList
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  pinned={resolvedChats.pinned}
                  unpinned={resolvedChats.unpinned}
                  pendingChats={resolvedChats.pendingChats}
                  onLongPressItem={onLongPressChat}
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
                <FloatingAddButton
                  setStartDmOpen={setStartDmOpen}
                  setAddGroupOpen={setAddGroupOpen}
                />
              </View>
              <WelcomeSheet
                open={splashVisible}
                onOpenChange={handleWelcomeOpenChange}
              />
              <ChatOptionsSheet
                ref={chatOptionsSheetRef}
                chatOptionsContext={chatOptionsContext}
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
              <InviteUsersSheet
                open={inviteSheetGroup !== null}
                onOpenChange={handleInviteSheetOpenChange}
                onInviteComplete={() => setInviteSheetGroup(null)}
                group={inviteSheetGroup ?? undefined}
              />
            </View>
            <NavBarView
              navigateToHome={() => {
                navigateToHome();
              }}
              navigateToNotifications={() => {
                navigateToNotifications();
              }}
              navigateToProfile={() => {
                navigateToProfile();
              }}
              currentRoute="ChatList"
              currentUserId={currentUser}
            />
          </ChatOptionsProvider>
        </RequestsProvider>
      </AppDataContextProvider>
    </CalmProvider>
  );
}
