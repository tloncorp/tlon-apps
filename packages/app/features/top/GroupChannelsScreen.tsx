import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ChatOptionsProvider,
  GroupChannelsScreenView,
  InviteUsersSheet,
  NavigationProvider,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupChannels'>;

export function GroupChannelsScreen({ route }: Props) {
  return <GroupChannelsScreenContent groupId={route.params.groupId} />;
}

export function GroupChannelsScreenContent({
  groupId: id,
  focusedChannelId,
}: {
  groupId: string;
  focusedChannelId?: string;
}) {
  const isFocused = useIsFocused();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>(
    null
  );
  const { group } = useGroupContext({ groupId: id, isFocused });
  const { data: unjoinedChannels } = store.useUnjoinedGroupChannels(
    group?.id ?? ''
  );
  const { navigateToChannel, navigation } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      navigateToChannel(channel);
    },
    [navigateToChannel]
  );

  const handleGoBackPressed = useCallback(() => {
    if (isWindowNarrow) {
      navigation.navigate('ChatList');
    } else {
      // Reset is necessary on desktop to ensure that the ChannelStack is cleared
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  }, [navigation, isWindowNarrow]);

  const handleJoinChannel = useCallback(
    async (channel: db.Channel) => {
      try {
        await store.joinGroupChannel({
          channelId: channel.id,
          groupId: id,
        });
      } catch (error) {
        console.error('Failed to join channel:', error);
      }
    },
    [id]
  );

  return (
    <ChatOptionsProvider
      onPressInvite={(group) => {
        setInviteSheetGroup(group);
      }}
      {...useChatSettingsNavigation()}
    >
      <NavigationProvider focusedChannelId={focusedChannelId}>
        <GroupChannelsScreenView
          onChannelPressed={handleChannelSelected}
          onBackPressed={handleGoBackPressed}
          onJoinChannel={handleJoinChannel}
          group={group}
          unjoinedChannels={unjoinedChannels}
        />
      </NavigationProvider>
      <InviteUsersSheet
        open={inviteSheetGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInviteSheetGroup(null);
          }
        }}
        group={inviteSheetGroup ?? undefined}
        onInviteComplete={() => setInviteSheetGroup(null)}
      />
    </ChatOptionsProvider>
  );
}
