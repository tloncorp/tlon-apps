import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import {
  AddGroupSheet,
  Button,
  ChatList,
  ChatOptionsProvider,
  ChatOptionsSheet,
  ChatOptionsSheetMethods,
  FloatingActionButton,
  GroupPreviewSheet,
  Icon,
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
import { useIsFocused } from '../../hooks/useIsFocused';
import { useFeatureFlag } from '../../lib/featureFlags';
import { identifyTlonEmployee } from '../../utils/posthog';
import { isSplashDismissed, setSplashDismissed } from '../../utils/splash';

export default function ChatListScreen({
  previewGroup,
  navigateToChannel,
  navigateToGroupChannels,
  navigateToSelectedPost,
  navigateToHome,
  navigateToNotifications,
  navigateToProfile,
  navigateToFindGroups,
  navigateToCreateGroup,
}: {
  navigateToChannel: (channel: db.Channel) => void;
  navigateToGroupChannels: (group: db.Group) => void;
  navigateToSelectedPost: (channel: db.Channel, postId?: string | null) => void;
  navigateToHome: () => void;
  navigateToNotifications: () => void;
  navigateToProfile: () => void;
  navigateToFindGroups: () => void;
  navigateToCreateGroup: () => void;
  previewGroup?: db.Group;
}) {
  const [addGroupOpen, setAddGroupOpen] = useState(false);
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
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(
    previewGroup ?? null
  );
  const [showSearchInput, setShowSearchInput] = useState(false);
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

  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pendingChats: pendingChats ?? [],
    };
  }, [chats, pendingChats]);

  const handleNavigateToFindGroups = useCallback(() => {
    setAddGroupOpen(false);
    navigateToFindGroups();
  }, [navigateToFindGroups]);

  const handleNavigateToCreateGroup = useCallback(() => {
    setAddGroupOpen(false);
    navigateToCreateGroup();
  }, [navigateToCreateGroup]);

  const goToDm = useCallback(
    async (userId: string) => {
      const dmChannel = await store.upsertDmChannel({
        participants: [userId],
      });
      setAddGroupOpen(false);
      navigateToChannel(dmChannel);
    },
    [navigateToChannel, setAddGroupOpen]
  );

  const handleAddGroupOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setAddGroupOpen(false);
    }
  }, []);

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

  return (
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
              pendingChats={resolvedChats.pendingChats}
              onLongPressItem={onLongPressChat}
              onPressItem={onPressChat}
              onPressMenuButton={onLongPressChat}
              onSectionChange={handleSectionChange}
              showSearchInput={showSearchInput}
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
          navigateToHome={navigateToHome}
          navigateToNotifications={navigateToNotifications}
          navigateToProfileSettings={navigateToProfile}
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
