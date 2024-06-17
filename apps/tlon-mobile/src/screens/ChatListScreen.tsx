import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import {
  CalmProvider,
  ChatList, // ChatOptionsSheet,
  ContactsProvider,
  FloatingActionButton,
  GroupPreviewSheet,
  Icon,
  ScreenHeader,
  StartDmSheet,
  View,
} from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';
import ContextMenu from 'react-native-context-menu-view';

import AddGroupSheet from '../components/AddGroupSheet';
import { TLON_EMPLOYEE_GROUP } from '../constants';
import { useCalmSettings } from '../hooks/useCalmSettings';
import * as featureFlags from '../lib/featureFlags';
import NavBar from '../navigation/NavBarView';
import type { HomeStackParamList } from '../types';
import { identifyTlonEmployee } from '../utils/posthog';

type ChatListScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'ChatList'
>;

export default function ChatListScreen(
  props: ChatListScreenProps & { contacts: db.Contact[] }
) {
  const [screenTitle, setScreenTitle] = useState('Home');
  {
    /* FIXME: Disabling long-press on ChatListScreen items for now */
  }
  // const [longPressedItem, setLongPressedItem] = useState<db.Channel | null>(
  //   null
  // );
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const [startDmOpen, setStartDmOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const isFocused = useIsFocused();
  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });
  const { data: contacts } = store.useContacts();
  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pendingChats: chats?.pendingChats ?? [],
    };
  }, [chats]);

  useFocusEffect(
    useCallback(() => {
      store.syncStaleChannels();
      return () => store.clearSyncQueue();
    }, [])
  );

  const { isFetching: isFetchingInitData } = store.useInitialSync();

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

  {
    /* FIXME: Disabling long-press on ChatListScreen items for now */
  }
  // const onLongPressItem = useCallback((item: db.Channel | db.Group) => {
  //   logic.isChannel(item) ? setLongPressedItem(item) : null;
  // }, []);

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

  {
    /* FIXME: Disabling long-press on ChatListScreen items for now */
  }
  // const handleChatOptionsOpenChange = useCallback(
  //   (open: boolean) => {
  //     if (!open) {
  //       setLongPressedItem(null);
  //     }
  //   },
  //   [setLongPressedItem]
  // );

  const handleGroupCreated = useCallback(
    ({ channel }: { channel: db.Channel }) => goToChannel({ channel }),
    [goToChannel]
  );

  const { pinned, unpinned } = resolvedChats;
  const allChats = [...pinned, ...unpinned];
  const isTlonEmployee = !!allChats.find(
    (obj) => obj.groupId === TLON_EMPLOYEE_GROUP
  );
  if (isTlonEmployee && TLON_EMPLOYEE_GROUP !== '') {
    identifyTlonEmployee();
  }

  const { calmSettings } = useCalmSettings();

  const handleSectionChange = useCallback((title: string) => {
    setScreenTitle(title);
  }, []);

  return (
    <CalmProvider calmSettings={calmSettings}>
      <ContactsProvider contacts={contacts ?? []}>
        <View backgroundColor="$background" flex={1}>
          <ScreenHeader title={isFetchingInitData ? 'Loading…' : screenTitle} />
          {chats && (chats.unpinned.length || !isFetchingInitData) ? (
            <ChatList
              pinned={resolvedChats.pinned}
              unpinned={resolvedChats.unpinned}
              pendingChats={resolvedChats.pendingChats}
              // FIXME: Disabling long-press on ChatListScreen items for now
              // onLongPressItem={onLongPressItem}
              onPressItem={onPressChat}
              onSectionChange={handleSectionChange}
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
          {/* FIXME: Disabling long-press on ChatListScreen items for now */}
          {/* <ChatOptionsSheet
          open={longPressedItem !== null}
          onOpenChange={handleChatOptionsOpenChange}
          channel={longPressedItem ?? undefined}
        /> */}
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
        <NavBar navigation={props.navigation} />
      </ContactsProvider>
    </CalmProvider>
  );
}
