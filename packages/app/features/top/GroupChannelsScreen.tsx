import {
  NavigationProp,
  useIsFocused,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ChatOptionsProvider,
  GroupChannelsScreenView,
  InviteUsersSheet,
} from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { useFeatureFlag } from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';

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
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>(
    null
  );
  const { group } = useGroupContext({ groupId: id, isFocused });
  const { data: unjoinedChannels } = store.useUnjoinedGroupChannels(
    group?.id ?? ''
  );

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      navigation.navigate('Channel', {
        channelId: channel.id,
        groupId: channel.groupId ?? undefined,
      });
    },
    [navigation]
  );

  const handleGoBackPressed = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  const [enableCustomChannels] = useFeatureFlag('customChannelCreation');

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
      <GroupChannelsScreenView
        onChannelPressed={handleChannelSelected}
        onBackPressed={handleGoBackPressed}
        onJoinChannel={handleJoinChannel}
        group={group}
        unjoinedChannels={unjoinedChannels}
        enableCustomChannels={enableCustomChannels}
        focusedChannelId={focusedChannelId}
      />
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
