import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import type { RootStackParamList } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ChatOptionsProvider,
  GroupChannelsScreenView,
  InviteUsersSheet,
  NavigationProvider,
  useIsWindowNarrow,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupChannels'>;

const logger = createDevLogger('GroupChannelsScreen', false);

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
  const isWindowNarrow = useIsWindowNarrow();
  const { group } = useGroupContext({ groupId: id, isFocused });
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);
  const { data: unjoinedChannels } = store.useUnjoinedGroupChannels(
    group?.id ?? ''
  );
  const { navigateToChannel, navigation } = useRootNavigation();

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      logger.trackEvent(
        AnalyticsEvent.ActionGroupChannelSelected,
        logic.getModelAnalytics({ channel })
      );
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

  const handlePressInvite = useCallback(
    (groupId: string) => {
      if (isWindowNarrow) {
        // Mobile: Use navigation to screen
        navigation.navigate('InviteUsers', { groupId });
      } else {
        // Desktop: Use sheet
        setInviteSheetGroup(groupId);
      }
    },
    [isWindowNarrow, navigation]
  );

  return (
    <ChatOptionsProvider
      onPressInvite={handlePressInvite}
      initialChat={{ type: 'group', id }}
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
      {!isWindowNarrow && (
        <InviteUsersSheet
          open={inviteSheetGroup !== null}
          onOpenChange={(open) => {
            if (!open) {
              setInviteSheetGroup(null);
            }
          }}
          groupId={inviteSheetGroup ?? undefined}
          onInviteComplete={() => setInviteSheetGroup(null)}
        />
      )}
    </ChatOptionsProvider>
  );
}
