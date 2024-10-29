import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ChatOptionsProvider,
  GroupChannelsScreenView,
  InviteUsersSheet,
} from '@tloncorp/ui';
import { useCallback, useMemo, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { useFeatureFlag } from '../../lib/featureFlags';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupChannels'>;

export function GroupChannelsScreen({ navigation, route }: Props) {
  const groupParam = route.params.group;
  const { id } = route.params.group;

  const isFocused = useIsFocused();
  const { data: pins } = store.usePins({
    enabled: isFocused,
  });
  const [inviteSheetGroup, setInviteSheetGroup] = useState<db.Group | null>(
    null
  );
  const { group } = useGroupContext({ groupId: id, isFocused });

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

  const [enableCustomChannels] = useFeatureFlag('customChannels');

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
        group={group}
        enableCustomChannels={enableCustomChannels}
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
