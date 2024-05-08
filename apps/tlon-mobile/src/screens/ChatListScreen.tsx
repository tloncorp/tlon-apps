import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  ChatList,
  ChatOptionsSheet,
  ContactsProvider,
  ScreenHeader,
  Spinner,
  View,
} from '@tloncorp/ui';
import { Icon } from '@tloncorp/ui';
import React from 'react';

import { useRefetchQueryOnFocus } from '../hooks/useRefetchQueryOnFocus';
import type { HomeStackParamList } from '../types';

type ChatListScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'ChatList'
>;

export default function ChatListScreen(
  props: ChatListScreenProps & { contacts: db.Contact[] }
) {
  const [longPressedItem, setLongPressedItem] =
    React.useState<db.Channel | null>(null);
  const { data: chats } = store.useCurrentChats();
  const { data: contacts } = store.useContacts();

  const { isFetching: isFetchingInitData, refetch } = store.useInitialSync();
  useRefetchQueryOnFocus(refetch);

  return (
    <ContactsProvider contacts={contacts ?? []}>
      <View backgroundColor="$background" flex={1}>
        <ScreenHeader
          title="Tlon"
          rightControls={
            <>
              {isFetchingInitData && <Spinner />}
              <Icon type="Add" onPress={() => {}} />
            </>
          }
        />
        {chats && (chats.unpinned.length || !isFetchingInitData) ? (
          <ChatList
            pinned={chats.pinned ?? []}
            unpinned={chats.unpinned ?? []}
            onLongPressItem={setLongPressedItem}
            onPressItem={(channel) => {
              props.navigation.navigate('Channel', { channel });
            }}
          />
        ) : null}
        <ChatOptionsSheet
          open={longPressedItem !== null}
          onOpenChange={(open) => (!open ? setLongPressedItem(null) : 'noop')}
          channel={longPressedItem ?? undefined}
        />
      </View>
    </ContactsProvider>
  );
}
