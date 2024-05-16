import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AddChatProvider,
  AddChatSheet,
  ChatList,
  ChatOptionsSheet,
  ContactsProvider,
  GroupInvitationSheet,
  Icon,
  ScreenHeader,
  Spinner,
  View,
} from '@tloncorp/ui/src';
import { useEffect, useState } from 'react';

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
  const [addChatOpen, setAddChatOpen] = useState(false);
  const { data: chats } = store.useCurrentChats();
  const { data: contacts } = store.useContacts();

  const { isFetching: isFetchingInitData, refetch } = store.useInitialSync();
  useRefetchQueryOnFocus(refetch);

  useEffect(() => {
    console.log(`pending:`, chats?.pendingGroups);
  }, [chats?.pendingGroups]);

  const goToDm = async (participants: string[]) => {
    const dmChannel = await store.upsertDmChannel({
      participants,
      currentUserId,
    });
    setAddChatOpen(false);
    props.navigation.push('Channel', { channel: dmChannel });
  };

  const goToChannel = ({ channel }: { channel: db.Channel }) => {
    setAddChatOpen(false);
    setTimeout(() => props.navigation.navigate('Channel', { channel }), 150);
  };

  const onPressChat = (item: db.Channel | db.Group) => {
    if (db.isGroup(item)) {
      setSelectedGroup(item);
    } else {
      props.navigation.navigate('Channel', { channel: item });
    }
  };

  const handleUpdateInvitation = (group: db.Group, accepted: boolean) => {
    if (accepted) {
      store.acceptGroupInvitation(group);
    } else {
      store.rejectGroupInvitation(group);
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
              <Icon type="Add" onPress={() => setAddChatOpen(true)} />
            </>
          }
        />
        {chats && (chats.unpinned.length || !isFetchingInitData) ? (
          <ChatList
            pinned={chats.pinned ?? []}
            unpinned={chats.unpinned ?? []}
            pendingGroups={chats.pendingGroups ?? []}
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
        <AddChatSheet
          currentUserId={currentUserId}
          goToChannel={goToChannel}
          goToDm={goToDm}
          open={addChatOpen}
          onOpenChange={() => setAddChatOpen(false)}
        />
        <GroupInvitationSheet
          open={selectedGroup !== null}
          onOpenChange={() => setSelectedGroup(null)}
          group={selectedGroup ?? undefined}
          onUpdateInvitation={handleUpdateInvitation}
        />
      </View>
      <NavBar navigation={props.navigation} />
    </ContactsProvider>
  );
}
