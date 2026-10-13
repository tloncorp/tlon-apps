import type { ConnectionStatus } from '@tloncorp/api';
import * as ub from '@tloncorp/api/urbit';
import type * as db from '@tloncorp/shared/db';
import {
  ConfirmDialog,
  Pressable,
  Text,
  pluralize,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { capitalize } from 'lodash';
import { type ReactNode, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { type ColorTokens, ScrollView, View, XStack, YStack } from 'tamagui';

import { useCalm, useContactIndex } from '../contexts/appDataContext';
import {
  channelSupportsNotifications,
  getChannelActionCapabilities,
  getChannelHost,
  getGroupMemberCount,
  useChatTitle,
  useGroupTitle,
} from '../utils';
import { ListItem } from './ListItem';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
  contactSettingsRow,
} from './SettingsList';
import { ProfileButton } from './UserProfileScreenView';

const maxMembersToDisplay = 5;
const avatarSize = 104;

export interface ChatDetailsScreenViewProps {
  chatType: 'group' | 'channel';
  group?: db.Group | null;
  channel?: db.Channel | null;
  currentUserId: string;
  currentUserIsAdmin: boolean;
  /** Whether the group's host can be reached, which admin changes need. */
  hostStatus: ConnectionStatus;
  /** How many roles the group has, counting the one every member holds. */
  roleCount: number;
  baseVolumeLevel: ub.NotificationLevel;
  /** The bot's tasks that post here. Left out, the row is not shown. */
  scheduledTaskCount?: number;
  onGoBack: () => void;
  onPressEdit: () => void;
  onPressInvite?: () => void;
  onMarkRead: () => void;
  onTogglePinned: () => void;
  onForward: () => void;
  onCopyGroupId: () => void;
  onPressPrivacy: () => void;
  onPressRoles: () => void;
  onPressChannels: () => void;
  onPressNotifications: () => void;
  onPressScheduledTasks: () => void;
  onPressChannelPermissions: () => void;
  /** Opens someone's profile, from the row naming a channel's host. */
  onPressProfile: (contactId: string) => void;
  /** Opens a group member. Left out, member rows are not pressable. */
  onPressMember?: (contactId: string) => void;
  onPressAllMembers: () => void;
  /** Leaves, after whatever confirmation the caller wants. */
  onLeave: () => void;
  /** Deletes. The view has already asked. */
  onDelete: () => void;
  /** Anything else the screen mounts, such as its sheets. */
  children?: ReactNode;
}

/**
 * The info screen for a group or a channel: who it is, what you can do with
 * it, its settings, its members, and leaving it.
 */
export function ChatDetailsScreenView({
  chatType,
  group,
  channel,
  currentUserId,
  currentUserIsAdmin,
  hostStatus,
  roleCount,
  baseVolumeLevel,
  scheduledTaskCount,
  onGoBack,
  onPressEdit,
  onPressInvite,
  onMarkRead,
  onTogglePinned,
  onForward,
  onCopyGroupId,
  onPressPrivacy,
  onPressRoles,
  onPressChannels,
  onPressNotifications,
  onPressScheduledTasks,
  onPressChannelPermissions,
  onPressProfile,
  onPressMember,
  onPressAllMembers,
  onLeave,
  onDelete,
  children,
}: ChatDetailsScreenViewProps) {
  const isWindowNarrow = useIsWindowNarrow();
  const contactIndex = useContactIndex();
  const { disableNicknames } = useCalm();
  const groupTitle = useGroupTitle(group) ?? 'group';
  const chatTitle = useChatTitle(channel, group);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // A channel outside a group is a DM, which has members and nothing else.
  const isGroup = chatType === 'group' && !!group;
  const isGroupChannel = chatType === 'channel' && !!channel?.groupId;
  const hasSettings = isGroup || isGroupChannel;

  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';
  const canInvite =
    (currentUserIsAdmin && actionsEnabled) || group?.privacy === 'public';
  const canEdit = currentUserIsAdmin && actionsEnabled;

  const isHost =
    chatType === 'group'
      ? !!group?.currentUserIsHost
      : !!channel?.currentUserIsHost;
  const channelCapabilities = getChannelActionCapabilities(channel);
  const canLeave =
    hasSettings &&
    !isHost &&
    (chatType !== 'channel' || channelCapabilities.canLeave);
  const canDelete =
    hasSettings &&
    (chatType !== 'channel' || channelCapabilities.canDelete) &&
    (isHost || (chatType === 'channel' && currentUserIsAdmin));

  const title =
    chatType === 'group' ? groupTitle : (chatTitle ?? channel?.title ?? '');

  const sections = useMemo(() => {
    const idPrefix = chatType === 'group' ? 'Group' : 'Channel';

    const quickActions: QuickAction[] = [];
    if (hasSettings) {
      const isPinned = chatType === 'group' ? group?.pin : channel?.pin;
      if (canInvite) {
        quickActions.push({
          title: 'Invite',
          onPress: onPressInvite,
          hero: true,
        });
      }
      if (chatType === 'group' && group?.unread?.count !== 0) {
        quickActions.push({ title: 'Mark read', onPress: onMarkRead });
      }
      quickActions.push({
        title: isPinned ? 'Unpin' : 'Pin',
        onPress: onTogglePinned,
      });
      if (chatType === 'group') {
        quickActions.push(
          { title: 'Forward reference', onPress: onForward },
          { title: 'Copy group ID', onPress: onCopyGroupId }
        );
      }
    }

    const hero: SettingsSectionModel = {
      key: 'hero',
      rows: [],
      element: (
        <ChatDetailsHero
          avatar={
            group && channel?.type !== 'buckets' ? (
              <ListItem.GroupIcon
                testID="GroupIcon"
                model={group}
                size="custom"
                width={avatarSize}
                height={avatarSize}
                borderRadius={24}
              />
            ) : channel ? (
              <ListItem.ChannelIcon
                model={channel}
                size="custom"
                width={avatarSize}
                height={avatarSize}
                borderRadius={24}
              />
            ) : null
          }
          title={title}
          subtitle={
            chatType === 'group'
              ? getGroupSubtitle(group)
              : channel
                ? getChannelSubtitle(channel, group, groupTitle)
                : undefined
          }
          hostStatus={isGroup ? getHostStatus(hostStatus) : undefined}
          description={
            chatType === 'group' ? group?.description : channel?.description
          }
          canEdit={canEdit}
          onPressEdit={onPressEdit}
          quickActions={quickActions}
          testIDPrefix={`${idPrefix}QuickAction`}
        />
      ),
    };

    const notificationRows: SettingsRowModel[] =
      chatType === 'group' || channelSupportsNotifications(channel)
        ? [
            {
              key: 'notifications',
              title: 'Notifications',
              subtitle: getNotificationTitle(
                chatType === 'group'
                  ? group?.volumeSettings
                  : channel?.volumeSettings,
                baseVolumeLevel
              ),
              onPress: onPressNotifications,
              testID: `${idPrefix}Notifications`,
            },
          ]
        : [];
    const scheduledTaskRows: SettingsRowModel[] =
      scheduledTaskCount === undefined
        ? []
        : [
            {
              key: 'scheduled-tasks',
              title: 'Scheduled tasks',
              value: `${scheduledTaskCount}`,
              onPress: onPressScheduledTasks,
              testID: `${idPrefix}ScheduledTasks`,
            },
          ];
    const adminRows: SettingsRowModel[] = !currentUserIsAdmin
      ? []
      : chatType === 'group'
        ? [
            {
              key: 'privacy',
              title: 'Privacy',
              value: capitalize(group?.privacy ?? ''),
              disabled: !actionsEnabled,
              onPress: onPressPrivacy,
              testID: 'GroupPrivacy',
            },
            {
              key: 'roles',
              title: 'Roles',
              value: `${roleCount}`,
              disabled: !actionsEnabled,
              onPress: onPressRoles,
              testID: 'GroupRoles',
            },
            {
              key: 'channels',
              title: 'Channels',
              value: `${group?.channels?.length ?? 0}`,
              disabled: !actionsEnabled,
              onPress: onPressChannels,
              testID: 'GroupChannels',
            },
          ]
        : [
            {
              key: 'permissions',
              title: 'Permissions',
              value:
                (channel?.readerRoles?.length ?? 0) > 0 ||
                (channel?.writerRoles?.length ?? 0) > 0
                  ? 'Custom'
                  : 'Public',
              disabled: !actionsEnabled,
              onPress: onPressChannelPermissions,
              testID: 'ChannelPrivacy',
            },
          ];

    const hostId =
      isGroupChannel && channel
        ? findChannelHost(channel, currentUserId)
        : null;
    const hostSection: SettingsSectionModel | null = hostId
      ? {
          key: 'host',
          title: 'Host',
          rows: [
            {
              ...contactSettingsRow(
                hostId,
                contactIndex?.[hostId],
                disableNicknames
              ),
              onPress: () => onPressProfile(hostId),
              testID: 'ChannelHost',
            },
          ],
        }
      : null;

    const members =
      (chatType === 'group' ? group?.members : channel?.members) ?? [];
    const joinedMembers = members.filter((m) => m.status === 'joined');
    const memberCount =
      chatType === 'group' && group
        ? getGroupMemberCount(group)
        : joinedMembers.length;
    const hiddenMemberCount = memberCount - maxMembersToDisplay;
    const opensMember = chatType === 'group' && !!group && !!onPressMember;
    const memberRows: SettingsRowModel[] = joinedMembers
      .slice(0, maxMembersToDisplay)
      .map((member) => ({
        ...contactSettingsRow(
          member.contactId,
          contactIndex?.[member.contactId],
          disableNicknames
        ),
        accessory: 'none',
        onPress: opensMember
          ? () => onPressMember(member.contactId)
          : undefined,
      }));
    if (hiddenMemberCount > 0 || canInvite) {
      memberRows.push({
        key: 'all-members',
        title:
          (canEdit ? 'Manage members' : 'See all') +
          (hiddenMemberCount > 0 ? ` (${hiddenMemberCount} more)` : ''),
        onPress: onPressAllMembers,
        testID: 'GroupMembers',
      });
    }

    const noun = chatType === 'group' ? 'group' : 'channel';
    const leaveRows: SettingsRowModel[] = [
      ...(canLeave
        ? [
            {
              key: 'leave',
              title: `Leave ${noun}`,
              destructive: true,
              onPress: onLeave,
              testID: `${idPrefix}LeaveAction-Leave ${noun}`,
            },
          ]
        : []),
      ...(canDelete
        ? [
            {
              key: 'delete',
              title: `Delete ${noun}`,
              destructive: true,
              onPress: () => setShowDeleteDialog(true),
              testID: `${idPrefix}LeaveAction-Delete ${noun}`,
            },
          ]
        : []),
    ];

    const all: (SettingsSectionModel | null)[] = [
      hero,
      hasSettings
        ? {
            key: 'settings',
            rows: [...adminRows, ...notificationRows, ...scheduledTaskRows],
          }
        : null,
      hostSection,
      members.length > 0
        ? {
            key: 'members',
            title: `${memberCount} ${pluralize(memberCount, 'Member')}`,
            rows: memberRows,
          }
        : null,
      { key: 'leave', rows: leaveRows },
    ];
    return all.filter(
      (section): section is SettingsSectionModel =>
        section !== null && (section.rows.length > 0 || !!section.element)
    );
  }, [
    actionsEnabled,
    baseVolumeLevel,
    canDelete,
    canEdit,
    canInvite,
    canLeave,
    channel,
    chatType,
    contactIndex,
    currentUserId,
    currentUserIsAdmin,
    disableNicknames,
    group,
    groupTitle,
    hasSettings,
    hostStatus,
    isGroup,
    isGroupChannel,
    onCopyGroupId,
    onForward,
    onLeave,
    onMarkRead,
    onPressAllMembers,
    onPressChannelPermissions,
    onPressChannels,
    onPressEdit,
    onPressInvite,
    onPressMember,
    onPressNotifications,
    onPressPrivacy,
    onPressProfile,
    onPressRoles,
    onPressScheduledTasks,
    onTogglePinned,
    roleCount,
    scheduledTaskCount,
    title,
  ]);

  const screenTitle =
    chatType === 'group' ? 'Group info & settings' : 'Channel info';

  return (
    <SettingsListScreenView
      // The name leads the screen itself on a phone, so the bar stays clear.
      title={Platform.OS === 'web' ? screenTitle : ''}
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
          text: 'Edit',
          onPress: onPressEdit,
          disabled: !actionsEnabled,
          tint: '$primaryText',
          testID: 'DetailsEditButton',
          visible: currentUserIsAdmin,
        },
      ]}
    >
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete ${title}?`}
        description={
          chatType === 'group'
            ? 'This action cannot be undone.'
            : channelCapabilities.deleteDescription
        }
        confirmText={chatType === 'group' ? 'Delete group' : 'Delete channel'}
        cancelText="Cancel"
        onConfirm={onDelete}
        destructive
      />
      {children}
    </SettingsListScreenView>
  );
}

interface QuickAction {
  title: string;
  onPress?: () => void;
  /** The one action drawn solid. */
  hero?: boolean;
}

interface HostStatus {
  label: string;
  color: ColorTokens;
}

/**
 * The top of the info screen: the avatar, the name and what kind of chat it
 * is, its description, and the row of quick actions.
 */
function ChatDetailsHero({
  avatar,
  title,
  subtitle,
  hostStatus,
  description,
  canEdit,
  onPressEdit,
  quickActions,
  testIDPrefix,
}: {
  avatar: ReactNode;
  title: string;
  subtitle?: string;
  hostStatus?: HostStatus;
  description?: string | null;
  canEdit: boolean;
  onPressEdit: () => void;
  quickActions: QuickAction[];
  testIDPrefix: string;
}) {
  return (
    <YStack alignItems="center" paddingTop="$m">
      {avatar}
      <Text
        size="$title/l"
        trimmed={false}
        textAlign="center"
        marginTop="$xl"
        paddingHorizontal="$xl"
        numberOfLines={2}
      >
        {title}
      </Text>
      <XStack
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
        columnGap="$m"
        marginTop="$xs"
        paddingHorizontal="$xl"
      >
        {subtitle ? (
          <Text size="$label/m" trimmed={false} color="$secondaryText">
            {subtitle}
          </Text>
        ) : null}
        {hostStatus ? (
          <XStack alignItems="center" gap="$s">
            <View
              width={8}
              height={8}
              borderRadius={4}
              backgroundColor={hostStatus.color}
            />
            <Text size="$label/m" trimmed={false} color="$secondaryText">
              {hostStatus.label}
            </Text>
          </XStack>
        ) : null}
      </XStack>
      {description ? (
        <Text
          size="$body"
          trimmed={false}
          textAlign="center"
          marginTop="$m"
          paddingHorizontal="$xl"
          numberOfLines={4}
        >
          {description}
        </Text>
      ) : canEdit ? (
        <Pressable onPress={onPressEdit} marginTop="$m" hitSlop={10}>
          <Text size="$body" trimmed={false} color="$positiveActionText">
            Add a description
          </Text>
        </Pressable>
      ) : null}
      {quickActions.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          alignSelf="stretch"
          marginTop="$2xl"
          contentContainerStyle={{ paddingHorizontal: heroSideInset }}
        >
          {quickActions.map((action) => (
            <ProfileButton
              key={action.title}
              title={action.title}
              onPress={action.onPress}
              hero={action.hero}
              testID={`${testIDPrefix}-${action.title}`}
            />
          ))}
        </ScrollView>
      ) : null}
    </YStack>
  );
}

/** The space the quick actions keep from the screen's edges. */
const heroSideInset = 12;

/** The ship hosting a channel, or nothing when its ID names none. */
function findChannelHost(channel: db.Channel, currentUserId: string) {
  try {
    return getChannelHost(channel, currentUserId);
  } catch {
    return null;
  }
}

function getHostStatus(status: ConnectionStatus): HostStatus {
  if (!status.complete) {
    return { label: 'Checking host…', color: '$tertiaryText' };
  }
  return status.status === 'yes'
    ? { label: 'Host online', color: '$green' }
    : { label: 'Host offline', color: '$orange' };
}

function getGroupSubtitle(group: db.Group | null | undefined) {
  if (!group) {
    return undefined;
  }
  const memberCount = getGroupMemberCount(group);
  return [
    group.privacy ? `${capitalize(group.privacy)} group` : 'Group',
    memberCount
      ? `with ${memberCount} ${pluralize(memberCount, 'member')}`
      : null,
  ]
    .filter((n) => !!n)
    .join(' ');
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
