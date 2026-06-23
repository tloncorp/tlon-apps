import { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

import { useRootNavigation } from '../../navigation/utils';
import {
  ListItem,
  ScreenHeader,
  ScrollView,
  TlonText,
  View,
  XStack,
  YStack,
  useChatOptions,
  useChatTitle,
  useCurrentUserId,
  useGroupTitle,
  useIsAdmin,
  useIsWindowNarrow,
} from '../../ui';
import {
  ChannelQuickActions,
  LeaveActionsSection,
  MembersList,
  SettingsSection,
} from './chatDetails';
import { useShipConnectionStatus } from './useShipConnectionStatus';

export function ChannelDetailsScreenView({
  onGoBack,
  onEditChannelMeta,
  onEditChannelPrivacy,
  onAfterDeleteChannel,
}: {
  onGoBack?: () => void;
  onEditChannelMeta: (channelId: string, groupId: string) => void;
  onEditChannelPrivacy: (channelId: string, groupId: string) => void;
  onAfterDeleteChannel?: () => void;
}) {
  const { channel, group } = useChatOptions();
  const { navigateToChannel, navigateBack } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUser);
  const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
    enabled: !!group,
  });
  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';
  const canInvite =
    (currentUserIsAdmin && actionsEnabled) || group?.privacy === 'public';

  const groupTitle = useGroupTitle(group) ?? 'group';
  const title = useChatTitle(channel, group);
  const insets = useSafeAreaInsets();

  const subtitle = useMemo(() => {
    if (!channel) return '';
    switch (channel.type) {
      case 'dm':
        return `Chat with ${channel.contactId}`;
      case 'groupDm':
        return channel.members &&
          channel.members.length > 0 &&
          channel.members.length > 2
          ? `Chat with ${channel.members[0].contactId} and ${channel.members.length - 1} others`
          : 'Group chat';
      default:
        return group
          ? group.channels?.length === 1
            ? `Group with ${group.members?.length ?? 0} members`
            : `Channel in ${groupTitle}`
          : '';
    }
  }, [channel, group, groupTitle]);

  const handlePressEdit = useCallback(() => {
    if (channel && channel.groupId) {
      onEditChannelMeta(channel.id, channel.groupId);
    }
  }, [channel, onEditChannelMeta]);

  const handleGoBack = useCallback(() => {
    if (onGoBack) {
      onGoBack();
      return;
    }
    if (isWindowNarrow) {
      navigateBack();
    } else if (channel) {
      navigateToChannel(channel);
    } else {
      navigateBack();
    }
  }, [onGoBack, channel, navigateToChannel, navigateBack, isWindowNarrow]);

  if (!channel) {
    return null;
  }

  const members = channel.members;

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        testID="ChatDetailsHeader"
        backgroundColor="$secondaryBackground"
        backAction={handleGoBack}
        useHorizontalTitleLayout={!isWindowNarrow}
        title="Channel info"
        rightControls={
          currentUserIsAdmin ? (
            <ScreenHeader.IconButton
              aria-label="Edit"
              onPress={!actionsEnabled ? undefined : handlePressEdit}
              disabled={!actionsEnabled}
              type="Draw"
              testID="DetailsEditButton"
            />
          ) : null
        }
      />
      <ScrollView
        flex={1}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 600,
          marginHorizontal: 'auto',
          gap: '$l',
          paddingBottom: insets.bottom + getTokenValue('$3xl' as any),
        }}
      >
        <XStack
          alignItems="flex-start"
          gap="$xl"
          paddingHorizontal="$xl"
          marginVertical="$l"
        >
          {group ? (
            <ListItem.GroupIcon model={group} size="$5xl" />
          ) : (
            <ListItem.ChannelIcon model={channel} size="$5xl" />
          )}
          <YStack gap="$l" flex={1}>
            <TlonText.Text>{title}</TlonText.Text>
            <TlonText.Text size={'$label/m'} color={'$secondaryText'}>
              {subtitle}
            </TlonText.Text>
          </YStack>
        </XStack>

        {channel.groupId && (
          <>
            <ChannelQuickActions channel={channel} canInvite={canInvite} />
            <SettingsSection
              entityType="channel"
              channel={channel}
              group={group}
              actionsEnabled={actionsEnabled}
              onEditChannelPrivacy={onEditChannelPrivacy}
            />
          </>
        )}

        {members?.length ? (
          <MembersList
            entityType="channel"
            members={members}
            canInvite={canInvite}
            canManage={currentUserIsAdmin && actionsEnabled}
          />
        ) : null}

        {channel.groupId && (
          <LeaveActionsSection
            entityType="channel"
            channel={channel}
            onAfterDeleteChannel={onAfterDeleteChannel}
          />
        )}
      </ScrollView>
    </View>
  );
}
