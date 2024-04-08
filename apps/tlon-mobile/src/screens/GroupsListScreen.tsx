import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import { ChatList, ChatOptionsSheet, View } from '@tloncorp/ui';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '../types';

type GroupsListScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'GroupsList'
>;

export default function GroupsListScreen(props: GroupsListScreenProps) {
  const [longPressedItem, setLongPressedItem] = React.useState<db.Chat | null>(
    null
  );
  const { pinned, unpinned } = db.useCurrentChats() ?? {};
  const { top } = useSafeAreaInsets();

  return (
    <View paddingTop={top} backgroundColor="$background" flex={1}>
      <ChatList
        pinned={Array.from(pinned ?? [])}
        unpinned={Array.from(unpinned ?? [])}
        onLongPressItem={setLongPressedItem}
        onPressItem={(channel) => {
          props.navigation.navigate('Channel', { channel });
        }}
      />
      <ChatOptionsSheet
        open={longPressedItem !== null}
        onOpenChange={(open) => (!open ? setLongPressedItem(null) : 'noop')}
        channel={longPressedItem ?? undefined}
      />
    </View>
  );
}
