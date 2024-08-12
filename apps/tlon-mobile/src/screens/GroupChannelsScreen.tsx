import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUserId } from '@tloncorp/app/hooks/useCurrentUser';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  AppDataContextProvider,
  ChatOptionsProvider,
  GroupChannelsScreenView,
} from '@tloncorp/ui';
import { useCallback, useMemo } from 'react';

import { useChatSettingsNavigation } from '../hooks/useChatSettingsNavigation';
import type { RootStackParamList } from '../types';

type GroupChannelsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'GroupChannels'
>;

export function GroupChannelsScreen({
  route,
  navigation,
}: GroupChannelsScreenProps) {
  const groupParam = route.params.group;
  const currentUser = useCurrentUserId();
  const isFocused = useIsFocused();
  const { data: chats } = store.useCurrentChats({
    enabled: isFocused,
  });

  const pinnedItems = useMemo(() => {
    return chats?.pinned ?? [];
  }, [chats]);

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      navigation.navigate('Channel', {
        channel: channel,
      });
    },
    [navigation]
  );

  const handleGoBackPressed = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const contactsQuery = store.useContacts();

  return (
    <AppDataContextProvider contacts={contactsQuery.data ?? null}>
      <ChatOptionsProvider
        groupId={groupParam.id}
        pinned={pinnedItems}
        useGroup={store.useGroup}
        {...useChatSettingsNavigation()}
      >
        <GroupChannelsScreenView
          onChannelPressed={handleChannelSelected}
          onBackPressed={handleGoBackPressed}
          currentUser={currentUser}
        />
      </ChatOptionsProvider>
    </AppDataContextProvider>
  );
}
