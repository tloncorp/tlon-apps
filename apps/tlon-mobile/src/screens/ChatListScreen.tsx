import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
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
import { useState } from 'react';

import AddGroupSheet from '../components/AddGroupSheet';
import { useCurrentUserId } from '../hooks/useCurrentUser';
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
  const currentUserId = useCurrentUserId();
  const [longPressedItem, setLongPressedItem] = useState<db.Channel | null>(
    null
  );
  const [selectedGroup, setSelectedGroup] = useState<db.Group | null>(null);
  const [startDmOpen, setStartDmOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const { data: chats } = store.useCurrentChats();
  const { data: contacts } = store.useContacts();

  const { isFetching: isFetchingInitData, refetch } =
    store.useInitialSync(currentUserId);
  useRefetchQueryOnFocus(refetch);

  const goToDm = async (participants: string[]) => {
    const dmChannel = await store.upsertDmChannel({
      participants,
      currentUserId,
    });
    setStartDmOpen(false);
    props.navigation.push('Channel', { channel: dmChannel });
  };

  const goToChannel = ({ channel }: { channel: db.Channel }) => {
    setStartDmOpen(false);
    setAddGroupOpen(false);
    setTimeout(() => props.navigation.navigate('Channel', { channel }), 150);
  };

  const onPressChat = (item: db.Channel | db.Group) => {
    if (db.isGroup(item)) {
      setSelectedGroup(item);
    } else {
      props.navigation.navigate('Channel', { channel: item });
    }
  };

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
            pinned={chats.pinned ?? []}
            unpinned={chats.unpinned ?? []}
            pendingChats={chats.pendingChats ?? []}
            onLongPressItem={(item) =>
              db.isChannel(item) ? setLongPressedItem(item) : null
            }
            onPressItem={onPressChat}
          />
        ) : null}
        <ChatOptionsSheet
          open={longPressedItem !== null}
          onOpenChange={(open) => (!open ? setLongPressedItem(null) : 'noop')}
          channel={longPressedItem ?? undefined}
        />
        <StartDmSheet
          goToDm={goToDm}
          open={startDmOpen}
          onOpenChange={() => setStartDmOpen(false)}
        />
        <AddGroupSheet
          open={addGroupOpen}
          onOpenChange={() => setAddGroupOpen(false)}
          onCreatedGroup={({ channel }) => goToChannel({ channel })}
          currentUserId={currentUserId}
        />
        <GroupPreviewSheet
          open={selectedGroup !== null}
          onOpenChange={() => setSelectedGroup(null)}
          group={selectedGroup ?? undefined}
        />
      </View>
      <NavBar navigation={props.navigation} />
    </ContactsProvider>
  );
}
