// Shared components for ChatDetailsScreen and ChannelDetailsScreen
import * as ub from '@tloncorp/api/urbit';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { capitalize } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { Spinner, isWeb } from 'tamagui';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { useRootNavigation } from '../../navigation/utils';
import {
  ActionSheet,
  ConfirmDialog,
  ContactListItem,
  GroupMemberProfileSheet,
  Icon,
  ListItem,
  PaddedBlock,
  Pressable,
  ProfileButton,
  ScrollView,
  TlonText,
  View,
  XStack,
  YStack,
  createActionGroup,
  pluralize,
  useChatOptions,
  useCurrentUserId,
  useGroupTitle,
  useIsAdmin,
} from '../../ui';
import { getStatusLabels } from '../../ui/components/ConnectionStatus';
import { useShipConnectionStatus } from './useShipConnectionStatus';

// Utility functions

const maxMembersToDisplay = 5;

function getNotificationTitle(
  volumeSettings: { level: ub.NotificationLevel } | null | undefined,
  baseVolumeLevel: ub.NotificationLevel
): string {
  if (volumeSettings?.level) {
    const levelName = ub.NotificationNamesShort[volumeSettings.level];
    return `${levelName} (custom)`;
  }
  const defaultLevelName = ub.NotificationNamesShort[baseVolumeLevel];
  return `${defaultLevelName} (app default)`;
}

// SettingsAction - individual settings row item

interface SettingsActionProps {
  title: string | React.ReactNode;
  description?: string;
  endValue?: string;
  disabled: boolean;
  testID: string;
  first?: boolean;
  last?: boolean;
  onPress: () => void;
}

function SettingsAction({
  title,
  description,
  endValue,
  disabled,
  testID,
  first,
  last,
  onPress,
}: SettingsActionProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      cursor={disabled ? 'default' : 'pointer'}
    >
      <ListItem
        paddingHorizontal="$2xl"
        backgroundColor={disabled ? '$secondaryBackground' : '$background'}
        borderTopLeftRadius={first ? '$2xl' : 0}
        borderTopRightRadius={first ? '$2xl' : 0}
        borderBottomLeftRadius={last ? '$2xl' : 0}
        borderBottomRightRadius={last ? '$2xl' : 0}
        borderLeftWidth={disabled ? 1 : 0}
        borderRightWidth={disabled ? 1 : 0}
        borderTopWidth={
          last && disabled ? 0 : first && disabled ? 1 : undefined
        }
        borderBottomWidth={
          first && disabled ? 0 : last && disabled ? 1 : undefined
        }
        borderColor={'$secondaryBorder'}
        alignItems="center"
        testID={testID}
      >
        <ActionSheet.ActionContent flex={1} flexShrink={0}>
          <ActionSheet.ActionTitle
            color={disabled ? '$tertiaryText' : undefined}
            numberOfLines={1}
          >
            {title}
          </ActionSheet.ActionTitle>
          {description && (
            <ActionSheet.ActionDescription>
              {description}
            </ActionSheet.ActionDescription>
          )}
        </ActionSheet.ActionContent>
        <ListItem.EndContent
          flexDirection="row"
          gap="$xl"
          alignItems="center"
          justifyContent="flex-end"
        >
          {endValue && (
            <ListItem.Title color="$tertiaryText">{endValue}</ListItem.Title>
          )}
          {!disabled && (
            <ActionSheet.ActionIcon type="ChevronRight" color="$tertiaryText" />
          )}
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
  );
}

// MembersList - displays members with invite option

export interface MembersListProps {
  entityType: 'group' | 'channel';
  members?: db.ChatMember[] | null;
  group?: db.Group | null;
  canInvite: boolean;
  canManage: boolean;
}

export function MembersList({
  entityType,
  members,
  group,
  canInvite,
  canManage,
}: MembersListProps) {
  const joinedMembers = members?.filter((m) => m.status === 'joined');
  const memberCount = joinedMembers?.length ?? 0;
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const { onPressGroupMembers, onPressChannelMembers, onPressInvite } =
    useChatOptions();
  const { navigation } = useRootNavigation();

  const handlePressSeeAllMembers = useCallback(() => {
    if (entityType === 'group') {
      onPressGroupMembers();
    } else {
      onPressChannelMembers();
    }
  }, [entityType, onPressChannelMembers, onPressGroupMembers]);

  const handlePressGoToProfile = useCallback(
    (contactId: string) => {
      navigation.navigate('UserProfile', { userId: contactId });
    },
    [navigation]
  );

  return (
    <View paddingHorizontal={'$l'}>
      <PaddedBlock width="100%" gap="$l" paddingBottom="$xl">
        <TlonText.Text size="$label/m" color="$tertiaryText">
          {memberCount} {pluralize(memberCount, 'Member')}
        </TlonText.Text>
        <YStack>
          {canInvite ? (
            <Pressable
              onPress={onPressInvite}
              testID={
                entityType === 'group'
                  ? 'GroupMembersInvitePeopleButton'
                  : 'ChannelMembersInvitePeopleButton'
              }
            >
              <XStack gap="$l" alignItems="center" height="$4xl">
                <View
                  width="$3xl"
                  height="$3xl"
                  backgroundColor={'$blueSoft'}
                  borderRadius="$xs"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Icon
                    type="Add"
                    color="$positiveActionText"
                    customSize={[20, 20]}
                  />
                </View>
                <TlonText.Text size="$label/l" color="$positiveActionText">
                  Invite People
                </TlonText.Text>
              </XStack>
            </Pressable>
          ) : null}
          {joinedMembers
            ?.slice(0, maxMembersToDisplay)
            .map((member: db.ChatMember) => (
              <ContactListItem
                size="$3xl"
                height="auto"
                padding={0}
                showNickname
                key={member.contactId}
                contactId={member.contactId}
                onPress={
                  entityType === 'group' && group
                    ? setSelectedContact
                    : undefined
                }
              />
            ))}
          {(memberCount > maxMembersToDisplay || canInvite) && (
            <Pressable onPress={handlePressSeeAllMembers}>
              <XStack
                height="$4xl"
                justifyContent="space-between"
                gap="$l"
                alignItems="center"
                $group-press={{ backgroundColor: '$secondaryBackground' }}
                testID="GroupMembers"
              >
                <TlonText.Text size="$label/l">
                  {canManage ? 'Manage members' : 'See all'}
                  {memberCount > maxMembersToDisplay &&
                    ` (${memberCount - maxMembersToDisplay} more)`}
                </TlonText.Text>
                <Icon type="ChevronRight" color="$tertiaryText" />
              </XStack>
            </Pressable>
          )}
        </YStack>
      </PaddedBlock>
      {entityType === 'group' && group ? (
        <GroupMemberProfileSheet
          selectedContact={selectedContact}
          onDismiss={() => setSelectedContact(null)}
          groupId={group.id}
          onPressGoToProfile={handlePressGoToProfile}
        />
      ) : null}
    </View>
  );
}

// ChannelQuickActions - simple quick actions for channels

export function ChannelQuickActions({
  channel,
  canInvite,
}: {
  channel: db.Channel;
  canInvite?: boolean;
}) {
  const { togglePinned, onPressInvite } = useChatOptions();
  const isPinned = channel?.pin;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      width={'100%'}
      paddingLeft={'$l'}
    >
      {canInvite && (
        <ProfileButton
          title="Invite"
          onPress={onPressInvite}
          testID="ChannelQuickAction-Invite"
          hero
        />
      )}
      <ProfileButton
        title={isPinned ? 'Unpin' : 'Pin'}
        onPress={togglePinned}
        testID={`ChannelQuickAction-${isPinned ? 'Unpin' : 'Pin'}`}
      />
    </ScrollView>
  );
}

// SettingsSection - unified settings for groups and channels

export interface SettingsSectionProps {
  entityType: 'group' | 'channel';
  channel?: db.Channel | null;
  group?: db.Group | null;
  actionsEnabled: boolean;
  onEditChannelPrivacy?: (channelId: string, groupId: string) => void;
}

export function SettingsSection({
  entityType,
  channel,
  group,
  actionsEnabled,
  onEditChannelPrivacy,
}: SettingsSectionProps) {
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUserId);

  const { groupRoles } = useGroupContext({
    groupId: group?.id ?? '',
  });

  const {
    onPressGroupPrivacy,
    onPressManageChannels,
    onPressChatVolume,
    onPressRoles,
    onPressEditChannelPrivacy: defaultOnPressEditChannelPrivacy,
  } = useChatSettingsNavigation();

  const navigateToEditChannelPrivacy =
    onEditChannelPrivacy ?? defaultOnPressEditChannelPrivacy;

  const baseVolumeLevel = store.useBaseVolumeLevel();

  const connectionStatus = useShipConnectionStatus(group?.hostUserId ?? '', {
    enabled: entityType === 'group' && !!group,
  });

  const connectionLabels = useMemo(
    () =>
      entityType === 'group' && group
        ? getStatusLabels(connectionStatus.status)
        : null,
    [entityType, group, connectionStatus.status]
  );

  const volumeSettings =
    entityType === 'group' ? group?.volumeSettings : channel?.volumeSettings;

  const notificationTitle = useMemo(
    () => getNotificationTitle(volumeSettings, baseVolumeLevel),
    [volumeSettings, baseVolumeLevel]
  );

  const handlePressGroupPrivacy = useCallback(() => {
    if (group) {
      onPressGroupPrivacy?.(group.id, true);
    }
  }, [group, onPressGroupPrivacy]);

  const handlePressManageChannels = useCallback(() => {
    if (group) {
      onPressManageChannels?.(group.id, true);
    }
  }, [group, onPressManageChannels]);

  const handlePressRoles = useCallback(() => {
    if (group) {
      onPressRoles?.(group.id, true);
    }
  }, [group, onPressRoles]);

  const handlePressEditChannelPrivacy = useCallback(() => {
    if (channel?.groupId) {
      navigateToEditChannelPrivacy(channel.id, channel.groupId);
    }
  }, [channel, navigateToEditChannelPrivacy]);

  const handlePressNotificationSettings = useCallback(() => {
    if (entityType === 'group' && group) {
      onPressChatVolume({ type: 'group', id: group.id, groupId: group.id });
    } else if (entityType === 'channel' && channel) {
      onPressChatVolume({
        type: 'channel',
        id: channel.id,
        groupId: channel.groupId ?? undefined,
      });
    }
  }, [entityType, group, channel, onPressChatVolume]);

  const actions = useMemo(() => {
    const notificationAction: SettingsActionProps = {
      title: 'Notifications',
      description: notificationTitle,
      testID:
        entityType === 'group' ? 'GroupNotifications' : 'ChannelNotifications',
      disabled: false,
      onPress: handlePressNotificationSettings,
    };

    if (!currentUserIsAdmin) {
      return [notificationAction];
    }

    if (entityType === 'group' && group) {
      const channelCount = group.channels?.length ?? 0;
      return [
        {
          title: 'Privacy',
          endValue: capitalize(group.privacy ?? ''),
          testID: 'GroupPrivacy',
          disabled: !actionsEnabled,
          onPress: handlePressGroupPrivacy,
        },
        {
          title: 'Roles',
          endValue: `${(groupRoles?.length ?? 0) + 1}`,
          testID: 'GroupRoles',
          disabled: !actionsEnabled,
          onPress: handlePressRoles,
        },
        {
          title: 'Channels',
          endValue: `${channelCount}`,
          testID: 'GroupChannels',
          disabled: !actionsEnabled,
          onPress: handlePressManageChannels,
        },
        notificationAction,
      ];
    }

    if (entityType === 'channel' && channel) {
      const isPrivate =
        (channel.readerRoles?.length ?? 0) > 0 ||
        (channel.writerRoles?.length ?? 0) > 0;
      return [
        {
          title: 'Permissions',
          endValue: isPrivate ? 'Custom' : 'Public',
          testID: 'ChannelPrivacy',
          disabled: !actionsEnabled,
          onPress: handlePressEditChannelPrivacy,
        },
        notificationAction,
      ];
    }

    return [notificationAction];
  }, [
    entityType,
    group,
    channel,
    currentUserIsAdmin,
    actionsEnabled,
    notificationTitle,
    handlePressNotificationSettings,
    handlePressGroupPrivacy,
    handlePressRoles,
    handlePressManageChannels,
    handlePressEditChannelPrivacy,
    groupRoles,
  ]);

  return (
    <View paddingHorizontal={'$l'}>
      <ActionSheet.ActionGroup
        padding={0}
        $gtSm={{ paddingHorizontal: 0 }}
        contentProps={{
          backgroundColor: '$background',
          borderRadius: '$2xl',
          borderWidth: 0,
        }}
      >
        {entityType === 'group' && group && connectionLabels && (
          <ListItem
            paddingHorizontal="$2xl"
            backgroundColor="$background"
            alignItems="center"
          >
            <ActionSheet.ActionContent flex={1} flexShrink={0}>
              <ActionSheet.ActionTitle>
                {connectionLabels.title}
              </ActionSheet.ActionTitle>
              <ActionSheet.ActionDescription>
                {connectionLabels.subtitle}
              </ActionSheet.ActionDescription>
            </ActionSheet.ActionContent>
            <ListItem.EndContent>
              {connectionLabels.icon ? (
                <Icon
                  type={connectionLabels.icon}
                  color={connectionLabels.color}
                />
              ) : (
                <Spinner size="small" />
              )}
            </ListItem.EndContent>
          </ListItem>
        )}
        {actions.map((action, index) => (
          <SettingsAction
            key={index}
            {...action}
            first={entityType === 'group' && group ? false : index === 0}
            last={index === actions.length - 1}
          />
        ))}
      </ActionSheet.ActionGroup>
    </View>
  );
}

// LeaveActionsSection - leave/delete actions for groups and channels

export interface LeaveActionsSectionProps {
  entityType: 'group' | 'channel';
  group?: db.Group;
  channel?: db.Channel;
  onAfterDeleteChannel?: () => void;
}

export function LeaveActionsSection({
  entityType,
  group,
  channel,
  onAfterDeleteChannel,
}: LeaveActionsSectionProps) {
  const { onLeaveGroup, onLeaveChannel } = useChatSettingsNavigation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { leaveGroup, leaveChannel } = useChatOptions();

  const { deleteGroup: deleteGroupFromContext } = useGroupContext({
    groupId: group?.id ?? '',
  });

  const groupTitle = useGroupTitle(group);

  const isHost =
    entityType === 'group'
      ? group?.currentUserIsHost
      : channel?.currentUserIsHost ?? false;
  const canLeave = !isHost;
  const canDelete = isHost;

  const chatTitle =
    entityType === 'group'
      ? groupTitle ?? 'group'
      : channel?.title ?? 'channel';

  const handleLeaveWithConfirm = useCallback(async () => {
    if (entityType === 'group') {
      const message = `You will no longer receive updates from this group.\n\nWarning: Leaving this group will invalidate any invitations you've sent.`;

      if (isWeb) {
        const confirmed = window.confirm(`Leave ${chatTitle}?\n\n${message}`);
        if (confirmed) {
          await leaveGroup();
        }
      } else {
        Alert.alert(`Leave ${chatTitle}?`, message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave Group', style: 'destructive', onPress: leaveGroup },
        ]);
      }
    } else {
      await leaveChannel();
    }
  }, [entityType, chatTitle, leaveGroup, leaveChannel]);

  const handleDelete = useCallback(async () => {
    if (entityType === 'group') {
      deleteGroupFromContext();
      onLeaveGroup();
    } else if (channel?.groupId) {
      try {
        await store.deleteChannel({
          channelId: channel.id,
          groupId: channel.groupId,
        });
        if (onAfterDeleteChannel) {
          onAfterDeleteChannel();
        } else {
          await onLeaveChannel(channel.groupId, channel.id);
        }
      } catch (error) {
        console.error('Failed to delete channel:', error);
        if (isWeb) {
          window.alert('Failed to delete channel. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to delete channel. Please try again.');
        }
      }
    }
  }, [
    entityType,
    channel,
    deleteGroupFromContext,
    onLeaveGroup,
    onLeaveChannel,
    onAfterDeleteChannel,
  ]);

  const leaveActions = createActionGroup(
    'negative',
    canLeave && {
      title: entityType === 'group' ? 'Leave group' : 'Leave channel',
      action: handleLeaveWithConfirm,
    },
    canDelete && {
      title: entityType === 'group' ? 'Delete group' : 'Delete channel',
      action: () => setShowDeleteDialog(true),
    }
  );

  if (leaveActions.actions.length === 0) {
    return null;
  }

  const deleteDescription =
    entityType === 'group'
      ? 'This action cannot be undone.'
      : 'This action cannot be undone. All messages in this channel will be permanently deleted.';

  return (
    <View paddingHorizontal={'$l'}>
      <ActionSheet.ActionGroup
        padding={0}
        $gtSm={{ paddingHorizontal: 0 }}
        contentProps={{ borderRadius: '$2xl' }}
        accent="negative"
      >
        {leaveActions.actions.map((action, i) => (
          <ActionSheet.Action
            key={i}
            action={action}
            testID={`${entityType === 'group' ? 'Group' : 'Channel'}LeaveAction-${action.title}`}
          />
        ))}
      </ActionSheet.ActionGroup>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete ${chatTitle}?`}
        description={deleteDescription}
        confirmText={entityType === 'group' ? 'Delete group' : 'Delete channel'}
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </View>
  );
}
