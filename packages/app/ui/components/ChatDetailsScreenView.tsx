import type { ConnectionStatus } from '@tloncorp/api';
import * as ub from '@tloncorp/api/urbit';
import type * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';
import {
  ConfirmDialog,
  Icon,
  type IconType,
  LoadingSpinner,
  Pressable,
  Text,
  pluralize,
  triggerHaptic,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { capitalize } from 'lodash';
import { type ReactNode, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ScrollView,
  View,
  XStack,
  YStack,
  getTokenValue,
  useTheme,
} from 'tamagui';

import { useContact } from '../contexts/appDataContext';
import {
  channelSupportsNotifications,
  getChannelActionCapabilities,
  getChannelHost,
  getChannelTypeIcon,
  getGroupMemberCount,
  useChatTitle,
  useGroupTitle,
  useIsAdmin,
} from '../utils';
import { ContactAvatar } from './Avatar';
import { ContactName } from './ContactNameV2';
import {
  ActionCircle,
  ActionCircleRow,
  BotTag,
  ConnectionMark,
  type ConnectionState,
  DestructiveCard,
  INFO_HEADER_AVATAR_RADIUS,
  INFO_HEADER_AVATAR_SIZE,
  INFO_HEADER_BADGE,
  InfoHeader,
  InfoHeaderBadge,
  InfoHeaderIconTile,
  InfoTile,
  ListCardDivider,
  SHARE_ICON_SIZE,
  SettingsCard,
  type SettingsCardRow,
  TextCard,
  connectionStateText,
  scheduledTasksRow,
} from './InfoCards';
import { ListItem } from './ListItem';
import {
  getLevelShortTitle,
  getNotificationLevelContext,
} from './NotificationLevelSelector';
import { ScreenHeader } from './ScreenHeader';
import type { ScreenHeaderMenuActionItem } from './ScreenHeader/actions';

const maxMembersToDisplay = 5;

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
  /** The bot's tasks that post here. Left out, the row is not shown. */
  scheduledTaskCount?: number;
  onGoBack: () => void;
  /** Edits the name and avatar. Left out, there is no Edit button. */
  onPressEdit?: () => void;
  onPressInvite?: () => void;
  onMarkRead: () => void;
  onTogglePinned: () => void;
  onForward: () => void;
  onCopyGroupId: () => void;
  /** Forwards a reference to the channel. Left out, there is no such action. */
  onForwardChannel?: () => void;
  /** Copies a link to the channel. Left out, there is no such action. */
  onCopyChannelLink?: () => void;
  /** Copies a description or someone's ID, and says so. */
  onCopyText: (text: string) => void;
  onPressPrivacy: () => void;
  onPressRoles: () => void;
  onPressChannels: () => void;
  /** Whether the workspace has Tlonbot instructions. Left out, no row. */
  instructions?: 'On' | 'Off';
  onPressInstructions?: () => void;
  onPressNotifications: () => void;
  onPressScheduledTasks: () => void;
  onPressChannelPermissions: () => void;
  /** Opens the info of the workspace a channel is in. */
  onPressWorkspace?: (group: db.Group) => void;
  /** Opens someone's profile. */
  onPressProfile: (contactId: string) => void;
  /** Opens a group member. Left out, member rows open the profile. */
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
 * The info screen for a workspace, a channel or a group chat, laid out like a
 * profile: who it is and what you can do with it, your settings, the admins'
 * settings, its members, its host, and leaving it.
 */
export function ChatDetailsScreenView({
  chatType,
  group,
  channel,
  currentUserId,
  currentUserIsAdmin,
  hostStatus,
  roleCount,
  scheduledTaskCount,
  onGoBack,
  onPressEdit,
  onPressInvite,
  onMarkRead,
  onTogglePinned,
  onForward,
  onCopyGroupId,
  onForwardChannel,
  onCopyChannelLink,
  onCopyText,
  onPressPrivacy,
  onPressRoles,
  onPressChannels,
  instructions,
  onPressInstructions,
  onPressNotifications,
  onPressScheduledTasks,
  onPressChannelPermissions,
  onPressWorkspace,
  onPressProfile,
  onPressMember,
  onPressAllMembers,
  onLeave,
  onDelete,
  children,
}: ChatDetailsScreenViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isWindowNarrow = useIsWindowNarrow();
  const groupTitle = useGroupTitle(group) ?? 'workspace';
  const chatTitle = useChatTitle(channel, group);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // A channel outside a group is a group chat or a DM.
  const isGroup = chatType === 'group' && !!group;
  const isGroupChannel = chatType === 'channel' && !!channel?.groupId;
  const isGroupDm = chatType === 'channel' && channel?.type === 'groupDm';
  const hasSettings = isGroup || isGroupChannel;

  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';
  const canInvite =
    (currentUserIsAdmin && actionsEnabled) || group?.privacy === 'public';
  const canEdit = currentUserIsAdmin && actionsEnabled;
  // Any member can rename a group chat; a workspace or channel needs an
  // admin with the host reachable.
  const showsEdit = !!onPressEdit && (isGroupDm || currentUserIsAdmin);
  const editEnabled = isGroupDm || canEdit;

  const isHost =
    chatType === 'group'
      ? !!group?.currentUserIsHost
      : !!channel?.currentUserIsHost;
  const channelCapabilities = getChannelActionCapabilities(channel);
  const canLeave =
    isGroupDm ||
    (hasSettings &&
      !isHost &&
      (chatType !== 'channel' || channelCapabilities.canLeave));
  const canDelete =
    hasSettings &&
    (chatType !== 'channel' || channelCapabilities.canDelete) &&
    (isHost || (chatType === 'channel' && currentUserIsAdmin));

  const title =
    chatType === 'group' ? groupTitle : (chatTitle ?? channel?.title ?? '');
  const idPrefix = chatType === 'group' ? 'Group' : 'Channel';
  const isPinned = chatType === 'group' ? group?.pin : channel?.pin;
  const description =
    (chatType === 'group' ? group?.description : channel?.description) ?? '';

  const members =
    (chatType === 'group' ? group?.members : channel?.members) ?? [];
  const joinedMembers = members.filter((m) => m.status === 'joined');
  const memberCount =
    chatType === 'group' && group
      ? getGroupMemberCount(group)
      : joinedMembers.length;

  const hostId = isGroup
    ? (group?.hostUserId ?? null)
    : isGroupChannel && channel
      ? findChannelHost(channel, currentUserId)
      : null;
  const hostState: ConnectionState = !hostStatus.complete
    ? 'pending'
    : hostStatus.status === 'yes'
      ? 'online'
      : 'offline';

  const notificationRows: SettingsCardRow[] =
    chatType === 'group' || channelSupportsNotifications(channel)
      ? [
          {
            key: 'notifications',
            title: 'Notifications',
            value: getNotificationValue(
              chatType === 'group'
                ? group?.volumeSettings
                : channel?.volumeSettings,
              getNotificationLevelContext(chatType === 'group' ? null : channel)
            ),
            onPress: onPressNotifications,
            testID: `${idPrefix}Notifications`,
          },
        ]
      : [];
  const scheduledTaskRows: SettingsCardRow[] =
    scheduledTaskCount === undefined
      ? []
      : [
          scheduledTasksRow({
            count: scheduledTaskCount,
            onPress: onPressScheduledTasks,
            testID: `${idPrefix}ScheduledTasks`,
          }),
        ];
  const yourRows = [...notificationRows, ...scheduledTaskRows];

  const adminRows: SettingsCardRow[] = !currentUserIsAdmin
    ? []
    : isGroup
      ? [
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
          ...(instructions && onPressInstructions
            ? [
                {
                  key: 'instructions',
                  title: 'Tlonbot instructions',
                  value: instructions,
                  disabled: !actionsEnabled,
                  onPress: onPressInstructions,
                  testID: 'GroupInstructions',
                },
              ]
            : []),
        ]
      : isGroupChannel
        ? [
            {
              key: 'permissions',
              title: 'Permissions',
              value:
                (channel?.readerRoles?.length ?? 0) > 0 ||
                (channel?.writerRoles?.length ?? 0) > 0
                  ? 'Custom'
                  : // The permissions screen's name for all members. "Public"
                    // would read against a private or secret group.
                    'Everyone',
              disabled: !actionsEnabled,
              onPress: onPressChannelPermissions,
              testID: 'ChannelPrivacy',
            },
          ]
        : [];

  const noun =
    chatType === 'group' ? 'workspace' : isGroupDm ? 'chat' : 'channel';
  const endActions = [
    ...(canLeave
      ? [
          {
            key: 'leave',
            title: `Leave ${noun}`,
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
            onPress: () => setShowDeleteDialog(true),
            testID: `${idPrefix}LeaveAction-Delete ${noun}`,
          },
        ]
      : []),
  ];

  const menuItems: ScreenHeaderMenuActionItem[] = [
    ...(isGroup
      ? [{ id: 'copy-group-id', label: 'Copy ID', onPress: onCopyGroupId }]
      : []),
    // Mark read is a circle for workspaces and chats; a channel keeps the
    // circles to sharing it.
    ...(isGroupChannel
      ? [{ id: 'mark-read', label: 'Mark read', onPress: onMarkRead }]
      : []),
  ];

  const screenTitle =
    chatType === 'group' ? 'Workspace info & settings' : 'Channel info';
  const loading = chatType === 'group' ? !group : !channel;

  return (
    <View flex={1} backgroundColor={theme.secondaryBackground.val}>
      <ScreenHeader
        // A phone, or a phone-sized window, leads with the name under the
        // avatar, so the bar stays clear.
        title={Platform.OS === 'web' && !isWindowNarrow ? screenTitle : ''}
        backgroundColor={theme.secondaryBackground.val}
        backAction={onGoBack}
        useHorizontalTitleLayout={!isWindowNarrow}
        testID="ChatDetailsHeader"
        placement="navigation"
        rightActions={[
          {
            id: 'DetailsEditButton',
            text: 'Edit',
            onPress: onPressEdit,
            disabled: !editEnabled,
            testID: 'DetailsEditButton',
            visible: showsEdit,
          },
          {
            id: 'details-more',
            icon: 'Overflow',
            label: 'More',
            testID: 'DetailsMoreButton',
            items: menuItems,
            visible: menuItems.length > 0,
          },
        ]}
      />
      {loading ? (
        <View flex={1} alignItems="center" justifyContent="center">
          <LoadingSpinner />
        </View>
      ) : (
        <ScrollView
          flex={1}
          contentContainerStyle={{
            width: '100%',
            maxWidth: 600,
            marginHorizontal: 'auto',
            paddingBottom: insets.bottom + getTokenValue('$3xl'),
          }}
        >
          <InfoHeader
            avatar={
              <ChatDetailsAvatar
                chatType={chatType}
                group={group}
                channel={channel}
              />
            }
            badge={
              isGroupChannel && group ? (
                <InfoHeaderBadge testID="ChannelWorkspaceBadge">
                  <ListItem.GroupIcon
                    model={group}
                    size="custom"
                    width={INFO_HEADER_BADGE.size}
                    height={INFO_HEADER_BADGE.size}
                    borderRadius={INFO_HEADER_BADGE.radius}
                  />
                </InfoHeaderBadge>
              ) : undefined
            }
            title={title}
            subtitle={
              chatType === 'group'
                ? memberCount
                  ? `${memberCount} ${pluralize(memberCount, 'member')}`
                  : undefined
                : channel
                  ? getChannelSubtitle(channel, groupTitle, memberCount)
                  : undefined
            }
          />

          <View marginTop="$2xl" paddingHorizontal="$xl">
            <ActionCircleRow>
              {isGroup && canInvite ? (
                <ActionCircle
                  icon="AddPerson"
                  label="Invite"
                  onPress={onPressInvite}
                  testID="GroupQuickAction-Invite"
                />
              ) : null}
              {(isGroup && group?.unread?.count !== 0) ||
              (!hasSettings && channel?.unread?.count !== 0) ? (
                <ActionCircle
                  icon="Checkmark"
                  label="Mark read"
                  onPress={onMarkRead}
                  testID={`${idPrefix}QuickAction-Mark read`}
                />
              ) : null}
              <ActionCircle
                icon="Pin"
                label={isPinned ? 'Unpin' : 'Pin'}
                onPress={onTogglePinned}
                testID={`${idPrefix}QuickAction-${isPinned ? 'Unpin' : 'Pin'}`}
              />
              {isGroup ? (
                <ActionCircle
                  icon="ArrowRef"
                  iconSize={SHARE_ICON_SIZE}
                  label="Share"
                  onPress={onForward}
                  testID="GroupQuickAction-Forward reference"
                />
              ) : null}
              {onForwardChannel ? (
                <ActionCircle
                  icon="ArrowRef"
                  iconSize={SHARE_ICON_SIZE}
                  label="Share"
                  onPress={onForwardChannel}
                  testID="ChannelQuickAction-Forward reference"
                />
              ) : null}
              {onCopyChannelLink ? (
                <ActionCircle
                  icon="Link"
                  label="Copy link"
                  onPress={onCopyChannelLink}
                  testID="ChannelQuickAction-Copy link to channel"
                />
              ) : null}
            </ActionCircleRow>
          </View>

          <YStack marginTop="$2xl" gap="$l" paddingHorizontal="$xl">
            {isGroupChannel && group ? (
              <WorkspaceCard group={group} onPress={onPressWorkspace} />
            ) : null}

            {hasSettings && (description || canEdit) ? (
              <TextCard
                title="Description"
                text={description}
                placeholder="Add a description"
                onPress={description ? undefined : onPressEdit}
                onLongPress={
                  description ? () => onCopyText(description) : undefined
                }
                testID={`${idPrefix}Description`}
              />
            ) : null}

            {yourRows.length ? (
              <SettingsCard
                title="Your settings"
                rows={yourRows}
                testID={`${idPrefix}YourSettings`}
              />
            ) : null}

            {adminRows.length ? (
              <YStack gap="$m">
                <SettingsCard
                  title={isGroup ? 'Workspace settings' : 'Channel settings'}
                  scope="Admins only"
                  rows={adminRows}
                  testID={`${idPrefix}AdminSettings`}
                />
                {!actionsEnabled ? (
                  // The only time the host's connection comes up in the
                  // settings: when it is why an admin's rows are off.
                  <View paddingHorizontal="$2xl">
                    <Text size="$label/s" color="$secondaryText">
                      {hostStatus.complete
                        ? 'The workspace’s host is offline, so these settings can’t be changed right now.'
                        : 'Checking the connection to the workspace’s host…'}
                    </Text>
                  </View>
                ) : null}
              </YStack>
            ) : null}

            {joinedMembers.length > 0 ? (
              <MembersCard
                chatType={chatType}
                groupId={isGroup ? group?.id : undefined}
                members={joinedMembers}
                memberCount={memberCount}
                currentUserId={currentUserId}
                showsAll={memberCount > maxMembersToDisplay || canInvite}
                onPressAll={onPressAllMembers}
                onPressMember={
                  isGroup && onPressMember ? onPressMember : onPressProfile
                }
              />
            ) : null}

            {hostId ? (
              <XStack gap="$l" width="100%">
                <InfoTile
                  label="Host"
                  value={connectionStateText(hostState)}
                  mark={<ConnectionMark status={hostState} />}
                  caption={hostId}
                  onPress={() => onPressProfile(hostId)}
                  // Opens their profile, like a member row; nothing to edit.
                  chevron={false}
                  testID={isGroup ? 'GroupHost' : 'ChannelHost'}
                />
                {isGroup && group?.privacy ? (
                  <InfoTile
                    label="Privacy"
                    value={capitalize(group.privacy)}
                    mark={
                      <Icon
                        type={privacyIcon[group.privacy]}
                        size="$l"
                        color="$primaryText"
                      />
                    }
                    caption={privacyCaption[group.privacy]}
                    onPress={
                      currentUserIsAdmin && actionsEnabled
                        ? onPressPrivacy
                        : undefined
                    }
                    testID="GroupPrivacy"
                  />
                ) : null}
              </XStack>
            ) : null}

            <DestructiveCard actions={endActions} />
          </YStack>
        </ScrollView>
      )}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete ${title}?`}
        description={
          chatType === 'group'
            ? 'This action cannot be undone.'
            : channelCapabilities.deleteDescription
        }
        confirmText={
          chatType === 'group' ? 'Delete workspace' : 'Delete channel'
        }
        cancelText="Cancel"
        onConfirm={onDelete}
        destructive
      />
      {children}
    </View>
  );
}

type GroupPrivacy = NonNullable<db.Group['privacy']>;

const privacyIcon: Record<GroupPrivacy, IconType> = {
  public: 'Discover',
  private: 'Lock',
  secret: 'EyeClosed',
};

const privacyCaption: Record<GroupPrivacy, string> = {
  public: 'Anyone can join',
  private: 'Join by request',
  secret: 'Invite only',
};

/**
 * The header avatar: a workspace's own, a channel's or chat's image, or a
 * white tile with the kind of channel it is.
 */
function ChatDetailsAvatar({
  chatType,
  group,
  channel,
}: {
  chatType: 'group' | 'channel';
  group?: db.Group | null;
  channel?: db.Channel | null;
}) {
  const custom = {
    size: 'custom',
    width: INFO_HEADER_AVATAR_SIZE,
    height: INFO_HEADER_AVATAR_SIZE,
    borderRadius: INFO_HEADER_AVATAR_RADIUS,
  } as const;
  if (chatType === 'group' && group) {
    return (
      <ListItem.GroupIcon
        testID="GroupIcon"
        model={group}
        membersBackgroundColor="$background"
        {...custom}
      />
    );
  }
  if (!channel) {
    return null;
  }
  if (channel.type === 'dm' || channel.iconImage) {
    return <ListItem.ChannelIcon model={channel} {...custom} />;
  }
  return <InfoHeaderIconTile icon={getChannelTypeIcon(channel.type)} />;
}

/** The workspace a channel is in, leading to its info. */
function WorkspaceCard({
  group,
  onPress,
}: {
  group: db.Group;
  onPress?: (group: db.Group) => void;
}) {
  const title = useGroupTitle(group);
  const memberCount = getGroupMemberCount(group);
  const handlePress = useCallback(() => {
    onPress?.(group);
    triggerHaptic('baseButtonClick');
  }, [group, onPress]);
  return (
    <Pressable
      borderRadius="$2xl"
      onPress={onPress ? handlePress : undefined}
      testID="ChannelWorkspace"
    >
      <XStack
        alignItems="center"
        gap="$l"
        padding="$l"
        paddingRight="$2xl"
        borderRadius="$2xl"
        backgroundColor="$background"
      >
        <ListItem.GroupIcon
          model={group}
          size="custom"
          width={44}
          height={44}
          borderRadius={12}
        />
        <YStack flex={1} minWidth={0}>
          <Text size="$label/l" numberOfLines={1}>
            {title}
          </Text>
          <Text size="$label/m" color="$secondaryText" marginTop="$xs">
            {memberCount
              ? `Workspace · ${memberCount} ${pluralize(memberCount, 'member')}`
              : 'Workspace'}
          </Text>
        </YStack>
        {onPress ? (
          <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
        ) : null}
      </XStack>
    </Pressable>
  );
}

/** The first few members, with See all leading to everyone. */
function MembersCard({
  chatType,
  groupId,
  members,
  memberCount,
  currentUserId,
  showsAll,
  onPressAll,
  onPressMember,
}: {
  chatType: 'group' | 'channel';
  /** Set for a workspace, whose admins are named. */
  groupId?: string;
  members: db.ChatMember[];
  memberCount: number;
  currentUserId: string;
  showsAll: boolean;
  onPressAll: () => void;
  onPressMember: (contactId: string) => void;
}) {
  const handlePressAll = useCallback(() => {
    onPressAll();
    triggerHaptic('baseButtonClick');
  }, [onPressAll]);
  return (
    <YStack
      borderRadius="$2xl"
      backgroundColor="$background"
      paddingTop="$2xl"
      paddingBottom="$s"
      testID={`${chatType === 'group' ? 'Group' : 'Channel'}MembersCard`}
    >
      <XStack
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="$2xl"
        paddingBottom="$s"
      >
        <Text size="$body" color="$tertiaryText">
          {`${memberCount} ${pluralize(memberCount, 'member')}`}
        </Text>
        {showsAll ? (
          <Pressable onPress={handlePressAll} testID="GroupMembers">
            <XStack alignItems="center" gap="$xs">
              <Text size="$label/m" color="$secondaryText">
                See all
              </Text>
              <Icon type="ChevronRight" size="$s" color="$tertiaryText" />
            </XStack>
          </Pressable>
        ) : null}
      </XStack>
      {members.slice(0, maxMembersToDisplay).map((member, i) => (
        <MemberRow
          key={member.contactId}
          contactId={member.contactId}
          groupId={groupId}
          isYou={member.contactId === currentUserId}
          first={i === 0}
          onPress={onPressMember}
        />
      ))}
    </YStack>
  );
}

const MEMBER_AVATAR = { size: 40, radius: 11 } as const;

function MemberRow({
  contactId,
  groupId,
  isYou,
  first,
  onPress,
}: {
  contactId: string;
  groupId?: string;
  isYou: boolean;
  first: boolean;
  onPress: (contactId: string) => void;
}) {
  const contact = useContact(contactId);
  const isAdmin = useIsAdmin(groupId ?? '', contactId);
  const isBot = domain.isBotContact({
    id: contactId,
    botInfo: contact?.botInfo,
  });
  const handlePress = useCallback(() => {
    onPress(contactId);
    triggerHaptic('baseButtonClick');
  }, [contactId, onPress]);
  return (
    <Pressable onPress={handlePress} testID={`MemberRow-${contactId}`}>
      {first ? null : <ListCardDivider avatarSize={MEMBER_AVATAR.size} />}
      <XStack alignItems="center" gap="$l" height={60} paddingHorizontal="$2xl">
        <ContactAvatar
          contactId={contactId}
          size="custom"
          width={MEMBER_AVATAR.size}
          height={MEMBER_AVATAR.size}
          borderRadius={MEMBER_AVATAR.radius}
        />
        <XStack flex={1} minWidth={0} alignItems="center" gap="$s">
          <Text size="$label/l" numberOfLines={1} flexShrink={1}>
            {isYou ? 'You' : <ContactName contactId={contactId} />}
          </Text>
          {isBot ? <BotTag onCard /> : null}
        </XStack>
        {groupId && isAdmin ? (
          <Text size="$label/m" color="$tertiaryText">
            Admin
          </Text>
        ) : null}
      </XStack>
    </Pressable>
  );
}

/** The ship hosting a channel, or nothing when its ID names none. */
function findChannelHost(channel: db.Channel, currentUserId: string) {
  try {
    return getChannelHost(channel, currentUserId);
  } catch {
    return null;
  }
}

function getChannelSubtitle(
  channel: db.Channel,
  groupTitle: string,
  memberCount: number
) {
  switch (channel.type) {
    case 'dm':
      return 'Direct message';
    case 'groupDm':
      return `Group chat with ${memberCount} ${pluralize(memberCount, 'member')}`;
    case 'buckets':
      return `Bucket in ${groupTitle}`;
    default:
      return channel.groupId ? `Channel in ${groupTitle}` : undefined;
  }
}

/** The chat's own level by the name its notifications screen uses. */
function getNotificationValue(
  volumeSettings: { level: ub.NotificationLevel } | null | undefined,
  context: ReturnType<typeof getNotificationLevelContext>
): string {
  const level = volumeSettings?.level;
  return !level || level === 'default'
    ? 'Default'
    : getLevelShortTitle(level, context);
}
