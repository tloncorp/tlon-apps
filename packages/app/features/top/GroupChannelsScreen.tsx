import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  ChatOptionsProvider,
  GroupChannelsScreenView,
  InviteUsersSheet,
} from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useCurrentUserId } from '../../hooks/useCurrentUser';
import { useGroupContext } from '../../hooks/useGroupContext';
import type { RootStackParamList } from '../../navigation/types';
import { trackInviteShared } from '../../utils/posthog';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupChannels'>;

export function GroupChannelsScreen({ navigation, route }: Props) {
  const groupParam = route.params.group;
  const { id } = route.params.group;

  const currentUser = useCurrentUserId();
  const isFocused = useIsFocused();
  const { data: pins } = store.usePins({
    enabled: isFocused,
  });
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>(
    null
  );
  const { group, createChannel } = useGroupContext({ groupId: id, isFocused });

  const pinnedItems = useMemo(() => {
    return pins ?? [];
  }, [pins]);

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

  return (
    <ChatOptionsProvider
      groupId={groupParam.id}
      pinned={pinnedItems}
      useGroup={store.useGroup}
      onPressInvite={(group) => {
        setInviteSheetGroup(group);
      }}
      {...useChatSettingsNavigation()}
    >
      <GroupChannelsScreenView
        onChannelPressed={handleChannelSelected}
        onBackPressed={handleGoBackPressed}
        currentUser={currentUser}
        createChannel={createChannel}
        group={group}
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
        onShareInvite={() => trackInviteShared(group?.id, currentUser)}
      />
    </ChatOptionsProvider>
  );
}
