import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useIsFocused } from '@react-navigation/native';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import {
  AddGroupSheet,
  ChatList,
  ChatOptionsProvider,
  ChatOptionsSheet,
  ChatOptionsSheetMethods,
  GroupPreviewSheet,
  InviteUsersSheet,
  RequestsProvider,
  ScreenHeader,
  View,
} from '@tloncorp/ui';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';

type DrawerContentProps = DrawerContentComponentProps & {
  onPressItem: (item: db.Group | db.Channel) => void;
  selectedGroup: db.Group | null;
  setSelectedGroup: (group: db.Group | null) => void;
};

export const ChatListDrawerContent = (props: DrawerContentProps) => {
  const { navigation, selectedGroup, setSelectedGroup } = props;
  const isFocused = useIsFocused();
  const { data: pendingChats } = store.usePendingChats({
    enabled: isFocused,
  });
  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });

  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pendingChats: pendingChats ?? [],
    };
  }, [chats, pendingChats]);
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'messages'>(
    'all'
  );
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [pressedChat, setPressedChat] = useState<db.Channel | db.Group | null>(
    null
  );
  const chatOptionsSheetRef = useRef<ChatOptionsSheetMethods>(null);
  const [screenTitle, setScreenTitle] = useState('Home');
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>();
  const [searchQuery, setSearchQuery] = useState('');

  const chatOptionsGroupId = useMemo(() => {
    if (!pressedChat) {
      return;
    }
    return logic.isGroup(pressedChat) ? pressedChat.id : pressedChat.group?.id;
  }, [pressedChat]);

  const chatOptionsChannelId = useMemo(() => {
    if (!pressedChat || logic.isGroup(pressedChat)) {
      return;
    }
    return pressedChat.id;
  }, [pressedChat]);

  const onPressMenuButton = useCallback((item: db.Channel | db.Group) => {
    if (logic.isChannel(item) && !item.isDmInvite) {
      setPressedChat(item);
      if (item.pin?.type === 'channel' || !item.group) {
        chatOptionsSheetRef.current?.open(item.id, item.type);
      } else {
        chatOptionsSheetRef.current?.open(item.group.id, 'group');
      }
    }
  }, []);

  const handleSearchInputToggled = useCallback(() => {
    if (showSearchInput) {
      setSearchQuery('');
    }
    setShowSearchInput(!showSearchInput);
  }, [showSearchInput]);

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

  const { data: pins } = store.usePins({
    enabled: isFocused,
  });
  const pinned = useMemo(() => pins ?? [], [pins]);

  const handleGroupPreviewSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSelectedGroup(null);
      }
    },
    [setSelectedGroup]
  );

  const handleInviteSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setInviteSheetGroup(null);
    }
  }, []);

  const goToDm = useCallback(
    async (userId: string) => {
      const dmChannel = await store.upsertDmChannel({
        participants: [userId],
      });
      setAddGroupOpen(false);
      navigation.navigate('Channel', { channel: dmChannel });
    },
    [navigation, setAddGroupOpen]
  );

  const handleAddGroupOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setAddGroupOpen(false);
    }
  }, []);

  const handleNavigateToFindGroups = useCallback(() => {
    setAddGroupOpen(false);
    navigation.navigate('FindGroups');
  }, [navigation]);

  const handleNavigateToCreateGroup = useCallback(() => {
    setAddGroupOpen(false);
    navigation.navigate('CreateGroup');
  }, [navigation]);

  const handleSectionChange = useCallback(
    (title: string) => {
      if (activeTab === 'all') {
        setScreenTitle(title);
      }
    },
    [activeTab]
  );

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
              onPressItem={props.onPressItem}
              showSearchInput={showSearchInput}
              onSearchToggle={handleSearchInputToggled}
              onSectionChange={handleSectionChange}
              onPressMenuButton={onPressMenuButton}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
            />
          ) : null}

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
};
