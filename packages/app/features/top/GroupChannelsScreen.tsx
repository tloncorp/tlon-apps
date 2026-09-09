import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AnalyticsEvent, createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { useCallback, useState } from 'react';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useAnyAgentGroupOnboardingLock } from '../../hooks/useAgentGroupOnboardingLock';
import { useGroupContext } from '../../hooks/useGroupContext';
import { getTopLevelTabRoute } from '../../navigation/topLevelTabs';
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
  const isWindowNarrow = useIsWindowNarrow();
  const { group } = useGroupContext({ groupId: id });
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);
  const { data: unjoinedChannels } = store.useUnjoinedGroupChannels(
    group?.id ?? ''
  );
  const { navigateToChannel, navigation } = useRootNavigation();
  const { locked: onboardingLocked, isLoading: onboardingLockLoading } =
    useAnyAgentGroupOnboardingLock();
  const navigationDisabled = onboardingLocked || onboardingLockLoading;

  const handleGoToGroupMembers = useCallback(() => {
    if (group && !navigationDisabled) {
      navigation.navigate('GroupSettings', {
        state: {
          routes: [{ name: 'GroupMembers', params: { groupId: group.id } }],
          index: 0,
        },
      });
    }
  }, [group, navigation, navigationDisabled]);

  const handleChannelSelected = useCallback(
    (channel: db.Channel) => {
      if (navigationDisabled) return;
      logger.trackEvent(
        AnalyticsEvent.ActionGroupChannelSelected,
        logic.getModelAnalytics({ channel })
      );
      navigateToChannel(channel);
    },
    [navigateToChannel, navigationDisabled]
  );

  const handleGoBackPressed = useCallback(() => {
    if (navigationDisabled) return;
    if (isWindowNarrow) {
      const route = getTopLevelTabRoute('ChatList');
      navigation.navigate(route.name, route.params, { pop: true });
    } else {
      // Reset is necessary on desktop to ensure that the ChannelStack is cleared
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  }, [navigation, isWindowNarrow, navigationDisabled]);

  const handleJoinChannel = useCallback(
    async (channel: db.Channel) => {
      if (navigationDisabled) return;
      try {
        await store.joinGroupChannel({
          channelId: channel.id,
          groupId: id,
        });
      } catch (error) {
        console.error('Failed to join channel:', error);
      }
    },
    [id, navigationDisabled]
  );

  const handlePressInvite = useCallback(
    (groupId: string) => {
      if (navigationDisabled) return;
      if (isWindowNarrow) {
        // Mobile: Use navigation to screen
        navigation.navigate('InviteUsers', { groupId });
      } else {
        // Desktop: Use sheet
        setInviteSheetGroup(groupId);
      }
    },
    [isWindowNarrow, navigation, navigationDisabled]
  );

  const chatSettingsNav = useChatSettingsNavigation();

  const handleLeaveChannel = useCallback(() => {
    // When leaving a channel from the channels list, don't navigate
    // This should be a no-op as the channel will be removed from the list
  }, []);

  return (
    <ChatOptionsProvider
      onPressInvite={handlePressInvite}
      initialChat={{ type: 'group', id }}
      {...chatSettingsNav}
      onLeaveChannel={handleLeaveChannel}
    >
      <NavigationProvider focusedChannelId={focusedChannelId}>
        <GroupChannelsScreenView
          onChannelPressed={handleChannelSelected}
          onBackPressed={handleGoBackPressed}
          onJoinChannel={handleJoinChannel}
          onGoToGroupMembers={handleGoToGroupMembers}
          onPressManageChannels={chatSettingsNav.onPressManageChannels}
          group={group}
          focusedChannelId={focusedChannelId}
          unjoinedChannels={unjoinedChannels}
          disabled={navigationDisabled}
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
