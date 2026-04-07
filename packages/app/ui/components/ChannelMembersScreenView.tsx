import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { View, getTokenValue } from 'tamagui';

import ContactName from './ContactName';
import { ScreenHeader } from './ScreenHeader';
import { ListItem } from './listItems';

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
      <ScreenHeader
        title="Members"
        loadingSubtitle={channel ? null : 'Loading…'}
        backAction={goBack}
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
