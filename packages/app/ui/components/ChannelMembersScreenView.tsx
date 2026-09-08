import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';
import { FlatList, ListRenderItemInfo } from 'react-native';
import { View, XStack, getTokenValue } from 'tamagui';

import { BotBadge } from './BotBadge';
import ContactName from './ContactName';
import { ListItem } from './ListItem';
import { ScreenHeader } from './ScreenHeader';
import { useScreenScrollProps } from './useScreenScrollProps';

export function ChannelMembersScreenView({
  channel,
  goBack,
}: {
  channel?: db.Channel;
  goBack: () => void;
}) {
  const screenScrollProps = useScreenScrollProps();
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<db.ChatMember>) => {
      return (
        <ListItem>
          <ListItem.ContactIcon contactId={item.contactId} />
          <ListItem.MainContent minWidth={0}>
            <XStack alignItems="center" gap="$s">
              <ListItem.Title flex={1} minWidth={0}>
                <ContactName showNickname={true} userId={item.contactId} />
              </ListItem.Title>
              <BotBadge contactId={item.contactId} />
            </XStack>
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
        placement="navigation"
      />
      <FlatList
        data={channel?.members}
        {...screenScrollProps}
        contentContainerStyle={{
          paddingHorizontal: getTokenValue('$l', 'size'),
        }}
        renderItem={renderItem}
      />
    </View>
  );
}
