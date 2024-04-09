import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import { ChatList, ChatOptionsSheet, View } from '@tloncorp/ui';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HomeStackParamList } from '../types';

type ChatListScreenProps = NativeStackScreenProps<
  HomeStackParamList,
  'ChatList'
>;

export default function ChatListScreen(props: ChatListScreenProps) {
  const [longPressedItem, setLongPressedItem] =
    React.useState<db.ChannelSummary | null>(null);
  const { pinned, unpinned } = db.useCurrentChats() ?? {
    pinned: [],
    unpinned: [],
  };
  const insets = useSafeAreaInsets();

  return (
    <View paddingTop={insets.top} backgroundColor="$background" flex={1}>
      <ChatList
        pinned={pinned}
        unpinned={unpinned}
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
