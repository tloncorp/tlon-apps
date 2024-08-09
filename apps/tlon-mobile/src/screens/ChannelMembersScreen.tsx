import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  ContactName,
  GenericHeader,
  ListItem,
} from '@tloncorp/ui';
import { useCallback } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { getTokenValue } from 'tamagui';

import { useCurrentUserId } from '../hooks/useCurrentUser';
import { RootStackParamList } from '../types';

type ChannelMembersScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ChannelMembers'
>;

export function ChannelMembersScreen(props: ChannelMembersScreenProps) {
  const { channelId } = props.route.params;
  const channelQuery = store.useChannelWithLastPostAndMembers({
    id: channelId,
  });

  const currentUserId = useCurrentUserId();
  const contactsQuery = store.useContacts();

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<db.ChatMember>) => {
      return (
        <ListItem>
          <ListItem.ContactIcon contactId={item.contactId} />
          <ListItem.MainContent>
            <ListItem.Title>
              <ContactName showNickname={true} userId={item.contactId} />
            </ListItem.Title>
            <ListItem.Subtitle>{item.contactId}</ListItem.Subtitle>
          </ListItem.MainContent>
        </ListItem>
      );
    },
    []
  );

  return (
    <AppDataContextProvider
      contacts={contactsQuery.data ?? null}
      currentUserId={currentUserId}
    >
      <GenericHeader title="Members" goBack={props.navigation.goBack} />
      <FlatList
        data={channelQuery.data?.members}
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$l', 'size'),
        }}
        renderItem={renderItem}
      />
    </AppDataContextProvider>
  );
}
