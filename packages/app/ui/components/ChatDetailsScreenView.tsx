import type { ConnectionStatus } from '@tloncorp/api';
import * as ub from '@tloncorp/api/urbit';
import type * as db from '@tloncorp/shared/db';
import {
  ConfirmDialog,
  Text,
  pluralize,
  useIsWindowNarrow,
} from '@tloncorp/ui';
import { capitalize } from 'lodash';
import { type ReactNode, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { ScrollView, XStack, YStack } from 'tamagui';

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
  getLevelShortTitle,
  getNotificationLevelContext,
} from './NotificationLevelSelector';
import {
  SETTINGS_LIST_COLUMN_WIDTH,
  type SettingsContextAction,
  type SettingsRowModel,
  type SettingsSectionModel,
  SettingsListScreenView,
  contactSettingsRow,
  useSettingsListSurfaces,
} from './SettingsList';
import { ProfileButton } from './UserProfileScreenView';

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
  onPressEdit: () => void;
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
  /** Opens someone's profile. */
  onPressProfile: (contactId: string) => void;
  /** Opens a direct message with someone. */
  onMessageContact: (contactId: string) => void;
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
  onPressProfile,
  onMessageContact,
  onPressMember,
  onPressAllMembers,
  onLeave,
  onDelete,
  children,
}: ChatDetailsScreenViewProps) {
  const isWindowNarrow = useIsWindowNarrow();
  const contactIndex = useContactIndex();
  const { disableNicknames } = useCalm();
  const groupTitle = useGroupTitle(group) ?? 'workspace';
  const chatTitle = useChatTitle(channel, group);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

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
        // Every action is drawn alike, so the name stays the screen's heaviest
        // element.
        quickActions.push({ title: 'Invite', onPress: onPressInvite });
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
          // Short enough that the row ends on a whole pill on a phone.
          { title: 'Forward', id: 'Forward reference', onPress: onForward },
          { title: 'Copy ID', id: 'Copy group ID', onPress: onCopyGroupId }
        );
      } else if (onForwardChannel && onCopyChannelLink) {
        quickActions.push(
          {
            title: 'Forward',
            id: 'Forward reference',
            onPress: onForwardChannel,
          },
          {
            title: 'Copy link',
            id: 'Copy link to channel',
            onPress: onCopyChannelLink,
          }
        );
      }
    }

    const description =
      chatType === 'group' ? group?.description : channel?.description;
    const hero: SettingsSectionModel = {
      key: 'hero',
      rows: [],
      element: (
        <ChatDetailsHero
          renderAvatar={(size, radius) =>
            group && channel?.type !== 'buckets' ? (
              <ListItem.GroupIcon
                testID="GroupIcon"
                model={group}
                size="custom"
                width={size}
                height={size}
                borderRadius={radius}
                membersBackgroundColor="$background"
              />
            ) : channel ? (
              <ListItem.ChannelIcon
                model={channel}
                size="custom"
                width={size}
                height={size}
                borderRadius={radius}
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
          quickActions={quickActions}
          testIDPrefix={`${idPrefix}QuickAction`}
        />
      ),
    };
    const descriptionSection: SettingsSectionModel | null =
      !description && !canEdit
        ? null
        : {
            key: 'description',
            title: 'Description',
            rows: [
              description
                ? {
                    key: 'description',
                    title: description,
                    // Only a description that may be cut off offers More.
                    expanded: mayBeCutOff(description)
                      ? descriptionExpanded
                      : undefined,
                    accessory: 'none',
                    onPress: mayBeCutOff(description)
                      ? () => setDescriptionExpanded((expanded) => !expanded)
                      : undefined,
                    contextActions: [
                      {
                        key: 'copy',
                        title: 'Copy',
                        systemImage: 'doc.on.doc',
                        onPress: () => onCopyText(description),
                      },
                    ],
                    testID: `${idPrefix}Description`,
                  }
                : {
                    key: 'description',
                    title: 'Add a description',
                    action: true,
                    onPress: onPressEdit,
                  },
            ],
          };

    const notificationRows: SettingsRowModel[] =
      chatType === 'group' || channelSupportsNotifications(channel)
        ? [
            {
              key: 'notifications',
              title: 'Notifications',
              value: getNotificationValue(
                chatType === 'group'
                  ? group?.volumeSettings
                  : channel?.volumeSettings,
                getNotificationLevelContext(
                  chatType === 'group' ? null : channel
                )
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
        : [
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
          ];

    // What a long press on someone's row offers. The first is what Android
    // and web run directly.
    const contactActions = (contactId: string): SettingsContextAction[] => [
      {
        key: 'profile',
        title: 'View profile',
        systemImage: 'person.crop.circle',
        onPress: () => onPressProfile(contactId),
      },
      ...(contactId === currentUserId
        ? []
        : [
            {
              key: 'message',
              title: 'Message',
              systemImage: 'message',
              onPress: () => onMessageContact(contactId),
            },
          ]),
      {
        key: 'copy-id',
        title: 'Copy ID',
        systemImage: 'doc.on.doc',
        onPress: () => onCopyText(contactId),
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
              // Opens their profile, like a member row; nothing to edit here.
              accessory: 'none',
              onPress: () => onPressProfile(hostId),
              contextActions: contactActions(hostId),
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
        contextActions: contactActions(member.contactId),
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

    const noun = chatType === 'group' ? 'workspace' : 'channel';
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
      descriptionSection,
      hasSettings
        ? {
            key: 'settings',
            // The only time the host's connection comes up: when it is why
            // an admin's rows are switched off.
            footer:
              currentUserIsAdmin && !actionsEnabled
                ? hostStatus.complete
                  ? 'The workspace’s host is offline, so these settings can’t be changed right now.'
                  : 'Checking the connection to the workspace’s host…'
                : undefined,
            rows: [...adminRows, ...notificationRows, ...scheduledTaskRows],
          }
        : null,
      hostSection,
      members.length > 0
        ? {
            key: 'members',
            title: `${memberCount} ${pluralize(memberCount, 'member')}`,
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
    canDelete,
    canEdit,
    canInvite,
    canLeave,
    channel,
    chatType,
    contactIndex,
    currentUserId,
    currentUserIsAdmin,
    descriptionExpanded,
    disableNicknames,
    group,
    groupTitle,
    hasSettings,
    hostStatus,
    instructions,
    isGroupChannel,
    onCopyChannelLink,
    onCopyGroupId,
    onCopyText,
    onForward,
    onForwardChannel,
    onLeave,
    onMarkRead,
    onMessageContact,
    onPressAllMembers,
    onPressChannelPermissions,
    onPressChannels,
    onPressEdit,
    onPressInstructions,
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
    chatType === 'group' ? 'Workspace info & settings' : 'Channel info';

  return (
    <SettingsListScreenView
      // The name leads the screen itself on a phone, or a phone-sized window,
      // so the bar stays clear.
      title={Platform.OS === 'web' && !isWindowNarrow ? screenTitle : ''}
      scrolledTitle={{ title, offset: chatHeroNameHeight }}
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
        confirmText={
          chatType === 'group' ? 'Delete workspace' : 'Delete channel'
        }
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
  /** Names the action's test ID when its title is shortened or changes. */
  id?: string;
  onPress?: () => void;
}

/**
 * The top of the info screen: the avatar with the name and what kind of chat
 * it is beside it, over the row of quick actions.
 */
function ChatDetailsHero({
  renderAvatar,
  title,
  subtitle,
  quickActions,
  testIDPrefix,
}: {
  renderAvatar: (size: number, radius: number) => ReactNode;
  title: string;
  subtitle?: string;
  quickActions: QuickAction[];
  testIDPrefix: string;
}) {
  const titleSize = title.length > longTitleLength ? 'compact' : 'full';
  // The actions are drawn like the list's cards: in the card color, which
  // stands off the page on native, and outlined on the web, where cards
  // share the page's color.
  const { card } = useSettingsListSurfaces();
  const pillBorder = Platform.OS === 'web' ? '$border' : card;
  return (
    <YStack paddingTop="$l">
      <XStack
        alignItems="center"
        gap="$xl"
        paddingHorizontal={chatHeroLeadingInset}
      >
        {renderAvatar(chatHeroAvatar.size, chatHeroAvatar.radius)}
        <YStack flex={1}>
          <Text
            size="$title/l"
            trimmed={false}
            numberOfLines={2}
            {...(titleSize === 'compact' ? compactTitleStyle : null)}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              size="$label/m"
              trimmed={false}
              color="$secondaryText"
              marginTop={subtitleOffset[titleSize]}
            >
              {subtitle}
            </Text>
          ) : null}
        </YStack>
      </XStack>
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
              key={action.id ?? action.title}
              title={action.title}
              onPress={action.onPress}
              testID={`${testIDPrefix}-${action.id ?? action.title}`}
              backgroundColor={card}
              borderColor={pillBorder}
            />
          ))}
        </ScrollView>
      ) : null}
    </YStack>
  );
}

// Names up to this long fit beside the avatar in two lines at the full title
// size; a longer one steps down a size instead of being cut off.
const longTitleLength = 14;
const compactTitleStyle = { fontSize: 26, lineHeight: 30 } as const;

// Puts the line under the name as far below it as a second line of the name
// sits below the first, so a wrapped name and its caption are evenly spaced.
// The two name sizes leave different room under their last line.
const subtitleOffset = { full: -2, compact: 0 } as const;

/**
 * Whether a description runs past the three lines its collapsed row shows,
 * so the row offers More. A phone line holds a little over forty characters;
 * counting each paragraph's lines from forty guesses slightly early, which
 * only offers More on text that already fits.
 */
function mayBeCutOff(description: string) {
  const lines = description
    .split('\n')
    .reduce(
      (sum, paragraph) => sum + Math.max(1, Math.ceil(paragraph.length / 40)),
      0
    );
  return lines > 3;
}

/** Where left-aligned header content starts: the cards' own 16pt margin. */
const chatHeroLeadingInset = 16;
const chatHeroAvatar = { size: 76, radius: 18 } as const;

/** How far the screen scrolls before the name in its header is out of view. */
const chatHeroNameHeight = 60;

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

function getGroupSubtitle(group: db.Group | null | undefined) {
  if (!group) {
    return undefined;
  }
  const memberCount = getGroupMemberCount(group);
  return [
    group.privacy ? `${capitalize(group.privacy)} workspace` : 'Workspace',
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
        return `Workspace with ${getGroupMemberCount(group)} members`;
      }
      return channel.type === 'buckets'
        ? `Bucket in ${groupTitle}`
        : `Channel in ${groupTitle}`;
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
