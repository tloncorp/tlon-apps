import * as db from '@tloncorp/shared/dist/db';
import { useCallback } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { View, getTokenValue } from 'tamagui';

import ContactName from './ContactName';
import { ListItem } from './ListItem';
import { GenericHeader } from './ScreenHeader';

export function ChannelMembersScreenView({
  channel,
  goBack,
}: {
  channel?: db.Channel;
  goBack: () => void;
}) {
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
    <View flex={1} backgroundColor="$background">
      <GenericHeader
        title={channel ? 'Loading...' : 'Members'}
        goBack={goBack}
      />
      <FlatList
        data={channel?.members}
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$l', 'size'),
        }}
        renderItem={renderItem}
      />
    </View>
  );
}
