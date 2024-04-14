import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type * as db from '@tloncorp/shared/dist/db';
import * as hooks from '@tloncorp/shared/dist/hooks';
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
    React.useState<db.Channel | null>(null);
  const { data: chats } = hooks.useCurrentChats();
  const insets = useSafeAreaInsets();

  return (
    <View paddingTop={insets.top} backgroundColor="$background" flex={1}>
      {chats && (
        <ChatList
          pinned={chats.pinned ?? []}
          unpinned={chats.unpinned ?? []}
          onLongPressItem={setLongPressedItem}
          onPressItem={(channel) => {
            props.navigation.navigate('Channel', { channel });
          }}
        />
      )}
      <ChatOptionsSheet
        open={longPressedItem !== null}
        onOpenChange={(open) => (!open ? setLongPressedItem(null) : 'noop')}
        channel={longPressedItem ?? undefined}
      />
    </View>
  );
}
