import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import {
  ChatList,
  ChatOptionsSheet,
  ContactsProvider,
  GroupPreviewSheet,
  Icon,
  ScreenHeader,
  Spinner,
  StartDmSheet,
  View,
} from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AddGroupSheet from '../components/AddGroupSheet';
import { useRefetchQueryOnFocus } from '../hooks/useRefetchQueryOnFocus';
import NavBar from '../navigation/NavBarView';
import type { HomeStackParamList } from '../types';

type ChatListScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'ChatList'
>;

export default function ChatListScreen(
  props: ChatListScreenProps & { contacts: db.Contact[] }
) {
  const [longPressedItem, setLongPressedItem] = useState<db.Channel | null>(
    null
  );
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const [startDmOpen, setStartDmOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const { data: chats } = store.useCurrentChats();
  const { data: contacts } = store.useContacts();
  const resolvedChats = useMemo(() => {
    return {
      pinned: chats?.pinned ?? [],
      unpinned: chats?.unpinned ?? [],
      pendingChats: chats?.pendingChats ?? [],
    };
  }, [chats]);

  const { isFetching: isFetchingInitData, refetch } = store.useInitialSync();
  useRefetchQueryOnFocus(refetch);

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
      } else {
        props.navigation.navigate('Channel', { channel: item });
      }
    },
    [props.navigation]
  );

  const onLongPressItem = useCallback((item: db.Channel | db.Group) => {
    logic.isChannel(item) ? setLongPressedItem(item) : null;
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
        setLongPressedItem(null);
      }
    },
    [setLongPressedItem]
  );

  const handleGroupCreated = useCallback(
    ({ channel }: { channel: db.Channel }) => goToChannel({ channel }),
    [goToChannel]
  );

  return (
    <ContactsProvider contacts={contacts ?? []}>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader
          title="Tlon"
          rightControls={
            <>
              {isFetchingInitData && <Spinner />}
              <Icon type="Add" onPress={() => setAddGroupOpen(true)} />
              <Icon type="Messages" onPress={() => setStartDmOpen(true)} />
            </>
          }
        />
        {chats && (chats.unpinned.length || !isFetchingInitData) ? (
          <ChatList
            pinned={resolvedChats.pinned}
            unpinned={resolvedChats.unpinned}
            pendingChats={resolvedChats.pendingChats}
            onLongPressItem={onLongPressItem}
            onPressItem={onPressChat}
          />
        ) : null}
        <ChatOptionsSheet
          open={longPressedItem !== null}
          onOpenChange={handleChatOptionsOpenChange}
          channel={longPressedItem ?? undefined}
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
      <NavBar navigation={props.navigation} />
    </ContactsProvider>
  );
}
