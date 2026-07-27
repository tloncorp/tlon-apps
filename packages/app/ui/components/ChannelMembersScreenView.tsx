import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';
import { FlatList, ListRenderItemInfo, Platform } from 'react-native';
import { View, getTokenValue } from 'tamagui';

import { usesNativeStackHeader } from '../../navigation/nativeHeaderOptions';
import ContactName from './ContactName';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';

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
      {!usesNativeStackHeader && (
        <ScreenHeader
          title="Members"
          loadingSubtitle={channel ? null : 'Loading…'}
          backAction={goBack}
        />
      )}
      <FlatList
        data={channel?.members}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : undefined
        }
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$l', 'size'),
        }}
        renderItem={renderItem}
      />
    </View>
  );
}
