// The group and channel info screens, drawn as one settings list.
import * as ub from '@tloncorp/api/urbit';
import type { ConnectionStatus } from '@tloncorp/api';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as Clipboard from 'expo-clipboard';
import { capitalize } from 'lodash';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { useRootNavigation } from '../../navigation/utils';
import {
  ConfirmDialog,
  GroupMemberProfileSheet,
  ListItem,
  pluralize,
  useCalm,
  useChatOptions,
  useChatTitle,
  useContactIndex,
  useCurrentUserId,
  useForwardGroupSheet,
  useGroupTitle,
  useIsAdmin,
  useIsWindowNarrow,
  useToast,
} from '../../ui';
import { getStatusLabels } from '../../ui/components/ConnectionStatus';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
  contactSettingsRow,
} from '../../ui/components/SettingsList';
import {
  destinationForChannel,
  tasksPostingTo,
} from '../../ui/components/automationTaskDraft';
import {
  channelSupportsNotifications,
  getChannelActionCapabilities,
  getChannelHost,
  getGroupMemberCount,
} from '../../ui/utils';
import { useBotDelivery } from '../automations/useBotDelivery';
import {
  useOpenScheduledTasks,
  useScheduledTasksEntry,
} from '../automations/useScheduledTasksEntry';
import { useShipConnectionStatus } from './useShipConnectionStatus';

type ChatType = 'group' | 'channel';

const maxMembersToDisplay = 5;

function getNotificationTitle(
  volumeSettings: { level: ub.NotificationLevel } | null | undefined,
  baseVolumeLevel: ub.NotificationLevel
): string {
  // One of the short names ends in a space.
  if (volumeSettings?.level) {
    const levelName = ub.NotificationNamesShort[volumeSettings.level].trim();
    return `${levelName} (custom)`;
  }
  const defaultLevelName = ub.NotificationNamesShort[baseVolumeLevel].trim();
  return `${defaultLevelName} (app default)`;
}

/**
 * The info screen for a group or a channel: who it is, what you can do with
 * it, its settings, its members, and leaving it.
 */
export function ChatDetailsView({
  chatType,
  onGoBack,
  onPressEdit,
  onEditChannelPrivacy,
  onAfterDeleteChannel,
}: {
  chatType: ChatType;
  onGoBack: () => void;
  onPressEdit: () => void;
  onEditChannelPrivacy: (channelId: string, groupId: string) => void;
  /** Where to go once a channel is deleted, if not out of the channel. */
  onAfterDeleteChannel?: () => void;
}) {
  const { channel, group } = useChatOptions();
  const isWindowNarrow = useIsWindowNarrow();

  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUserId);
  const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
    enabled: !!group,
  });
  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';
  const canInvite =
    (currentUserIsAdmin && actionsEnabled) || group?.privacy === 'public';

  // A channel outside a group is a DM, which has members and nothing else.
  const isGroup = chatType === 'group' && !!group;
  const isGroupChannel = chatType === 'channel' && !!channel?.groupId;

  const identitySection = useIdentitySection({ chatType, channel, group });
  const quickActionRows = useQuickActionRows({
    chatType,
    channel,
    group,
    canInvite,
  });
  const settingsRows = useSettingsRows({
    chatType,
    channel,
    group,
    hostStatus,
    currentUserIsAdmin,
    actionsEnabled,
    onEditChannelPrivacy,
  });
  const hostRow = useChannelHostRow(isGroupChannel ? channel : null);
  const members = useMembersSection({
    chatType,
    members: chatType === 'group' ? group?.members : channel?.members,
    group,
    canInvite,
    canManage: currentUserIsAdmin && actionsEnabled,
  });
  const leave = useLeaveRows({
    chatType,
    channel: isGroupChannel ? channel : null,
    group: isGroup ? group : null,
    onAfterDeleteChannel,
  });

  const sections = useMemo(() => {
    const hasSettings = isGroup || isGroupChannel;
    const all: (SettingsSectionModel | null)[] = [
      identitySection,
      hasSettings ? { key: 'actions', rows: quickActionRows } : null,
      hasSettings ? { key: 'settings', rows: settingsRows } : null,
      hostRow ? { key: 'host', title: 'Host', rows: [hostRow] } : null,
      members.section,
      { key: 'leave', rows: leave.rows },
    ];
    return all.filter(
      (section): section is SettingsSectionModel =>
        section !== null && section.rows.length > 0
    );
  }, [
    hostRow,
    identitySection,
    isGroup,
    isGroupChannel,
    leave.rows,
    members.section,
    quickActionRows,
    settingsRows,
  ]);

  return (
    <SettingsListScreenView
      title={chatType === 'group' ? 'Group info & settings' : 'Channel info'}
      headerTestID="ChatDetailsHeader"
      sections={sections}
      loading={chatType === 'group' ? !group : !channel}
      onBackPressed={onGoBack}
      showsBackOnWideWindows
      useHorizontalTitleLayout={!isWindowNarrow}
      maxWidth={SETTINGS_LIST_COLUMN_WIDTH}
      rightActions={[
        {
          id: 'DetailsEditButton',
          text: 'Rename',
          onPress: onPressEdit,
          disabled: !actionsEnabled,
          tint: '$primaryText',
          testID: 'DetailsEditButton',
          visible: currentUserIsAdmin,
        },
      ]}
    >
      {members.sheet}
      {leave.dialog}
    </SettingsListScreenView>
  );
}

/** The icon and name at the top, with a group's description under it. */
function useIdentitySection({
  chatType,
  channel,
  group,
}: {
  chatType: ChatType;
  channel?: db.Channel | null;
  group?: db.Group | null;
}): SettingsSectionModel | null {
  const groupTitle = useGroupTitle(group) ?? 'group';
  const title = useChatTitle(channel, group);

  return useMemo(() => {
    if (chatType === 'group') {
      if (!group) {
        return null;
      }
      const memberCount = getGroupMemberCount(group);
      const subtitle = [
        group.privacy ? `${capitalize(group.privacy)} group` : 'Group',
        memberCount
          ? `with ${memberCount} ${pluralize(memberCount, 'member')}`
          : null,
      ]
        .filter((n) => !!n)
        .join(' ');
      return {
        key: 'identity',
        footer: group.description || undefined,
        rows: [
          {
            key: 'identity',
            title: title ?? groupTitle,
            subtitle,
            prominent: true,
            leading: {
              kind: 'element',
              render: ({ size }) => (
                <ListItem.GroupIcon
                  testID="GroupIcon"
                  model={group}
                  size="custom"
                  width={size}
                  height={size}
                  borderRadius="$m"
                />
              ),
            },
          },
        ],
      };
    }

    if (!channel) {
      return null;
    }
    return {
      key: 'identity',
      rows: [
        {
          key: 'identity',
          title: title ?? 'Channel',
          subtitle: getChannelSubtitle(channel, group, groupTitle),
          prominent: true,
          leading: {
            kind: 'element',
            render: ({ size }) =>
              group && channel.type !== 'buckets' ? (
                <ListItem.GroupIcon
                  model={group}
                  size="custom"
                  width={size}
                  height={size}
                  borderRadius="$m"
                />
              ) : (
                <ListItem.ChannelIcon
                  model={channel}
                  size="custom"
                  width={size}
                  height={size}
                  borderRadius="$m"
                />
              ),
          },
        },
      ],
    };
  }, [channel, chatType, group, groupTitle, title]);
}

function getChannelSubtitle(
  channel: db.Channel,
  group: db.Group | null | undefined,
  groupTitle: string
) {
  switch (channel.type) {
    case 'dm':
      return `Chat with ${channel.contactId}`;
    case 'groupDm':
      return channel.members && channel.members.length > 2
        ? `Chat with ${channel.members[0].contactId} and ${channel.members.length - 1} others`
        : 'Group chat';
    default:
      if (!group) {
        return undefined;
      }
      if (group.channels?.length === 1) {
        return `Group with ${getGroupMemberCount(group)} members`;
      }
      return channel.type === 'buckets'
        ? `Bucket in ${groupTitle}`
        : `Channel in ${groupTitle}`;
  }
}

/** Things to do with the chat right here, without opening another screen. */
function useQuickActionRows({
  chatType,
  channel,
  group,
  canInvite,
}: {
  chatType: ChatType;
  channel?: db.Channel | null;
  group?: db.Group | null;
  canInvite: boolean;
}): SettingsRowModel[] {
  const { markGroupRead, togglePinned, onPressInvite } = useChatOptions();
  const forwardGroupSheet = useForwardGroupSheet();
  const toast = useToast();

  const handleForwardGroup = useCallback(() => {
    if (group) {
      forwardGroupSheet.open(group);
    }
  }, [forwardGroupSheet, group]);

  const handleCopyGroupId = useCallback(async () => {
    if (group) {
      await Clipboard.setStringAsync(group.id);
      toast({ message: 'Copied!', duration: 1500 });
    }
  }, [group, toast]);

  return useMemo(() => {
    const idPrefix =
      chatType === 'group' ? 'GroupQuickAction' : 'ChannelQuickAction';
    const action = (title: string, onPress?: () => void): SettingsRowModel => ({
      key: title,
      title,
      action: true,
      onPress,
      testID: `${idPrefix}-${title}`,
    });
    const isPinned = chatType === 'group' ? group?.pin : channel?.pin;
    const pin = action(isPinned ? 'Unpin' : 'Pin', togglePinned);

    if (chatType === 'channel') {
      return [...(canInvite ? [action('Invite', onPressInvite)] : []), pin];
    }
    return [
      ...(canInvite ? [action('Invite', onPressInvite)] : []),
      ...(group?.unread?.count === 0
        ? []
        : [action('Mark read', markGroupRead)]),
      pin,
      action('Forward reference', handleForwardGroup),
      action('Copy group ID', handleCopyGroupId),
    ];
  }, [
    canInvite,
    channel?.pin,
    chatType,
    group?.pin,
    group?.unread?.count,
    handleCopyGroupId,
    handleForwardGroup,
    markGroupRead,
    onPressInvite,
    togglePinned,
  ]);
}

/**
 * The chat's settings, each opening its own screen. Admins get the group's or
 * channel's own settings; everyone gets their notifications, and the bot's
 * scheduled tasks where it has any.
 */
function useSettingsRows({
  chatType,
  channel,
  group,
  hostStatus,
  currentUserIsAdmin,
  actionsEnabled,
  onEditChannelPrivacy,
}: {
  chatType: ChatType;
  channel?: db.Channel | null;
  group?: db.Group | null;
  hostStatus: ConnectionStatus;
  currentUserIsAdmin: boolean;
  actionsEnabled: boolean;
  onEditChannelPrivacy: (channelId: string, groupId: string) => void;
}): SettingsRowModel[] {
  const { groupRoles } = useGroupContext({
    groupId: group?.id ?? '',
  });
  const {
    onPressGroupPrivacy,
    onPressManageChannels,
    onPressChatVolume,
    onPressRoles,
  } = useChatSettingsNavigation();

  const baseVolumeLevel = store.useBaseVolumeLevel();
  const volumeSettings =
    chatType === 'group' ? group?.volumeSettings : channel?.volumeSettings;

  // Anyone with a bot can see what it is scheduled to post into this group
  // or this channel, admin or not. The row shows once the bot has something
  // scheduled here or could be given something: in a group, as a member with
  // a channel to post in; in a channel, where it may write in that channel.
  const isGroupChannel = chatType === 'channel' && !!channel?.groupId;
  const scheduledTasks = useScheduledTasksEntry({
    enabled: (chatType === 'group' && !!group) || isGroupChannel,
  });
  const openScheduledTasks = useOpenScheduledTasks();
  const { delivery: botDelivery } = useBotDelivery(scheduledTasks.botShip, {
    enabled: isGroupChannel && scheduledTasks.visible,
  });
  const channelIdsHere = useMemo(() => {
    if (chatType === 'channel') return channel ? [channel.id] : undefined;
    return group ? (group.channels?.map(({ id }) => id) ?? []) : undefined;
  }, [chatType, channel, group]);
  const scheduledTaskCount = useMemo(
    () =>
      scheduledTasks.tasks && channelIdsHere
        ? Object.keys(
            tasksPostingTo(scheduledTasks.tasks, new Set(channelIdsHere))
          ).length
        : undefined,
    [scheduledTasks.tasks, channelIdsHere]
  );
  const botCouldPostHere =
    chatType === 'channel'
      ? Boolean(channel && destinationForChannel(channel, botDelivery))
      : Boolean(group?.channels?.length) &&
        Boolean(
          group?.members?.some(
            (member) => member.contactId === scheduledTasks.botShip
          )
        );
  const showsScheduledTasks =
    scheduledTasks.visible &&
    scheduledTaskCount !== undefined &&
    (scheduledTaskCount > 0 || botCouldPostHere);
  const { botShip } = scheduledTasks;
  const handlePressScheduledTasks = useCallback(() => {
    if (chatType === 'channel') {
      if (channel?.groupId) {
        openScheduledTasks(
          { botShip, groupId: channel.groupId, channelId: channel.id },
          channel.id
        );
      }
    } else if (group) {
      openScheduledTasks(
        { botShip, groupId: group.id },
        group.channels?.[0]?.id
      );
    }
  }, [chatType, channel, group, openScheduledTasks, botShip]);

  return useMemo(() => {
    const idPrefix = chatType === 'group' ? 'Group' : 'Channel';
    const scheduledTaskRows: SettingsRowModel[] = showsScheduledTasks
      ? [
          {
            key: 'scheduled-tasks',
            title: 'Scheduled tasks',
            value: `${scheduledTaskCount}`,
            onPress: handlePressScheduledTasks,
            testID: `${idPrefix}ScheduledTasks`,
          },
        ]
      : [];
    const notificationRows: SettingsRowModel[] =
      chatType === 'group' || channelSupportsNotifications(channel)
        ? [
            {
              key: 'notifications',
              title: 'Notifications',
              subtitle: getNotificationTitle(volumeSettings, baseVolumeLevel),
              onPress: () => {
                if (chatType === 'group' && group) {
                  onPressChatVolume({
                    type: 'group',
                    id: group.id,
                    groupId: group.id,
                  });
                } else if (chatType === 'channel' && channel) {
                  onPressChatVolume({
                    type: 'channel',
                    id: channel.id,
                    groupId: channel.groupId ?? undefined,
                  });
                }
              },
              testID: `${idPrefix}Notifications`,
            },
          ]
        : [];

    if (chatType === 'group') {
      if (!group) {
        return [];
      }
      const connection = getStatusLabels(hostStatus.status);
      const adminRows: SettingsRowModel[] = currentUserIsAdmin
        ? [
            {
              key: 'privacy',
              title: 'Privacy',
              value: capitalize(group.privacy ?? ''),
              disabled: !actionsEnabled,
              onPress: () => onPressGroupPrivacy(group.id, true),
              testID: 'GroupPrivacy',
            },
            {
              key: 'roles',
              title: 'Roles',
              value: `${(groupRoles?.length ?? 0) + 1}`,
              disabled: !actionsEnabled,
              onPress: () => onPressRoles(group.id, true),
              testID: 'GroupRoles',
            },
            {
              key: 'channels',
              title: 'Channels',
              value: `${group.channels?.length ?? 0}`,
              disabled: !actionsEnabled,
              onPress: () => onPressManageChannels(group.id, true),
              testID: 'GroupChannels',
            },
          ]
        : [];
      return [
        {
          key: 'connection',
          title: connection.title,
          subtitle: connection.subtitle,
        },
        ...adminRows,
        ...notificationRows,
        ...scheduledTaskRows,
      ];
    }

    if (!channel?.groupId) {
      return [];
    }
    const { id: channelId, groupId } = channel;
    const hasCustomPermissions =
      (channel.readerRoles?.length ?? 0) > 0 ||
      (channel.writerRoles?.length ?? 0) > 0;
    return [
      ...(currentUserIsAdmin
        ? [
            {
              key: 'permissions',
              title: 'Permissions',
              value: hasCustomPermissions ? 'Custom' : 'Public',
              disabled: !actionsEnabled,
              onPress: () => onEditChannelPrivacy(channelId, groupId),
              testID: 'ChannelPrivacy',
            },
          ]
        : []),
      ...notificationRows,
      ...scheduledTaskRows,
    ];
  }, [
    actionsEnabled,
    baseVolumeLevel,
    channel,
    chatType,
    currentUserIsAdmin,
    group,
    groupRoles?.length,
    handlePressScheduledTasks,
    hostStatus.status,
    onEditChannelPrivacy,
    onPressChatVolume,
    onPressGroupPrivacy,
    onPressManageChannels,
    onPressRoles,
    scheduledTaskCount,
    showsScheduledTasks,
    volumeSettings,
  ]);
}

/** The ship that hosts a group's channel, opening its profile. */
function useChannelHostRow(
  channel: db.Channel | null | undefined
): SettingsRowModel | null {
  const currentUserId = useCurrentUserId();
  const { navigation } = useRootNavigation();
  const contactIndex = useContactIndex();
  const { disableNicknames } = useCalm();

  return useMemo(() => {
    if (!channel) {
      return null;
    }
    let hostId: string;
    try {
      hostId = getChannelHost(channel, currentUserId);
    } catch {
      return null;
    }
    return {
      ...contactSettingsRow(hostId, contactIndex?.[hostId], disableNicknames),
      onPress: () => navigation.navigate('UserProfile', { userId: hostId }),
      testID: 'ChannelHost',
    };
  }, [channel, contactIndex, currentUserId, disableNicknames, navigation]);
}

/**
 * The first few members, with a way to invite more and to see everyone. A
 * group's members open their profile sheet, which this also supplies.
 */
function useMembersSection({
  chatType,
  members,
  group,
  canInvite,
  canManage,
}: {
  chatType: ChatType;
  members?: db.ChatMember[] | null;
  group?: db.Group | null;
  canInvite: boolean;
  canManage: boolean;
}): { section: SettingsSectionModel | null; sheet: ReactNode } {
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const { onPressGroupMembers, onPressChannelMembers, onPressInvite } =
    useChatOptions();
  const { navigation } = useRootNavigation();
  const contactIndex = useContactIndex();
  const { disableNicknames } = useCalm();

  const handlePressGoToProfile = useCallback(
    (contactId: string) => {
      navigation.navigate('UserProfile', { userId: contactId });
    },
    [navigation]
  );

  const section = useMemo<SettingsSectionModel | null>(() => {
    if (!members?.length) {
      return null;
    }
    const joinedMembers = members.filter((m) => m.status === 'joined');
    const memberCount =
      chatType === 'group' && group
        ? getGroupMemberCount(group)
        : joinedMembers.length;
    const opensProfile = chatType === 'group' && !!group;

    const rows: SettingsRowModel[] = [];
    if (canInvite) {
      rows.push({
        key: 'invite',
        title: 'Invite People',
        action: true,
        onPress: onPressInvite,
        testID:
          chatType === 'group'
            ? 'GroupMembersInvitePeopleButton'
            : 'ChannelMembersInvitePeopleButton',
      });
    }
    for (const member of joinedMembers.slice(0, maxMembersToDisplay)) {
      rows.push({
        ...contactSettingsRow(
          member.contactId,
          contactIndex?.[member.contactId],
          disableNicknames
        ),
        accessory: 'none',
        onPress: opensProfile
          ? () => setSelectedContact(member.contactId)
          : undefined,
      });
    }
    if (memberCount > maxMembersToDisplay || canInvite) {
      const hiddenCount = memberCount - maxMembersToDisplay;
      rows.push({
        key: 'all-members',
        title:
          (canManage ? 'Manage members' : 'See all') +
          (hiddenCount > 0 ? ` (${hiddenCount} more)` : ''),
        onPress:
          chatType === 'group' ? onPressGroupMembers : onPressChannelMembers,
        testID: 'GroupMembers',
      });
    }
    return {
      key: 'members',
      title: `${memberCount} ${pluralize(memberCount, 'Member')}`,
      rows,
    };
  }, [
    canInvite,
    canManage,
    chatType,
    contactIndex,
    disableNicknames,
    group,
    members,
    onPressChannelMembers,
    onPressGroupMembers,
    onPressInvite,
  ]);

  const sheet =
    chatType === 'group' && group ? (
      <GroupMemberProfileSheet
        selectedContact={selectedContact}
        onDismiss={() => setSelectedContact(null)}
        groupId={group.id}
        onPressGoToProfile={handlePressGoToProfile}
      />
    ) : null;

  return { section, sheet };
}

/**
 * Leaving and deleting, for whoever may do each, with the dialog that
 * confirms a deletion.
 */
function useLeaveRows({
  chatType,
  group,
  channel,
  onAfterDeleteChannel,
}: {
  chatType: ChatType;
  group?: db.Group | null;
  channel?: db.Channel | null;
  onAfterDeleteChannel?: () => void;
}): { rows: SettingsRowModel[]; dialog: ReactNode } {
  const { onLeaveGroup, onLeaveChannel } = useChatSettingsNavigation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { leaveGroup, leaveChannel } = useChatOptions();
  const { deleteGroup } = useGroupContext({ groupId: group?.id ?? '' });
  const groupTitle = useGroupTitle(group);

  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(
    (chatType === 'group' ? group?.id : channel?.groupId) ?? '',
    currentUserId
  );

  const exists = chatType === 'group' ? !!group : !!channel;
  const isHost =
    chatType === 'group'
      ? group?.currentUserIsHost
      : (channel?.currentUserIsHost ?? false);
  const channelCapabilities = getChannelActionCapabilities(channel);
  const canLeave =
    exists &&
    !isHost &&
    (chatType !== 'channel' || channelCapabilities.canLeave);
  const canDelete =
    exists &&
    (chatType !== 'channel' || channelCapabilities.canDelete) &&
    (isHost || (chatType === 'channel' && currentUserIsAdmin));

  const chatTitle =
    chatType === 'group'
      ? (groupTitle ?? 'group')
      : (channel?.title ?? 'channel');

  const handleLeave = useCallback(async () => {
    if (chatType !== 'group') {
      await leaveChannel();
      return;
    }
    const message = `You will no longer receive updates from this group.\n\nWarning: Leaving this group will invalidate any invitations you've sent.`;
    if (isWeb) {
      if (window.confirm(`Leave ${chatTitle}?\n\n${message}`)) {
        await leaveGroup();
      }
    } else {
      Alert.alert(`Leave ${chatTitle}?`, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Group', style: 'destructive', onPress: leaveGroup },
      ]);
    }
  }, [chatType, chatTitle, leaveGroup, leaveChannel]);

  const handleDelete = useCallback(async () => {
    if (chatType === 'group') {
      deleteGroup();
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
    chatType,
    channel,
    deleteGroup,
    onLeaveGroup,
    onLeaveChannel,
    onAfterDeleteChannel,
  ]);

  const rows = useMemo(() => {
    const noun = chatType === 'group' ? 'group' : 'channel';
    const idPrefix =
      chatType === 'group' ? 'GroupLeaveAction' : 'ChannelLeaveAction';
    const destructive = (
      title: string,
      onPress: () => void
    ): SettingsRowModel => ({
      key: title,
      title,
      destructive: true,
      onPress,
      testID: `${idPrefix}-${title}`,
    });
    return [
      ...(canLeave ? [destructive(`Leave ${noun}`, handleLeave)] : []),
      ...(canDelete
        ? [destructive(`Delete ${noun}`, () => setShowDeleteDialog(true))]
        : []),
    ];
  }, [canDelete, canLeave, chatType, handleLeave]);

  const dialog = (
    <ConfirmDialog
      open={showDeleteDialog}
      onOpenChange={setShowDeleteDialog}
      title={`Delete ${chatTitle}?`}
      description={
        chatType === 'group'
          ? 'This action cannot be undone.'
          : channelCapabilities.deleteDescription
      }
      confirmText={chatType === 'group' ? 'Delete group' : 'Delete channel'}
      cancelText="Cancel"
      onConfirm={handleDelete}
      destructive
    />
  );

  return { rows, dialog };
}
