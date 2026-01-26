import Clipboard from '@react-native-clipboard/clipboard';
import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import { capitalize } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue, isWeb } from 'tamagui';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { RootStackParamList, RootStackRouteProp } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ActionSheet,
  ChatOptionsProvider,
  ConfirmDialog,
  ContactListItem,
  ForwardGroupSheetProvider,
  Icon,
  InviteUsersSheet,
  ListItem,
  PaddedBlock,
  Pressable,
  ProfileButton,
  ScreenHeader,
  ScrollView,
  TlonText,
  View,
  XStack,
  YStack,
  createActionGroup,
  pluralize,
  useChatOptions,
  useChatTitle,
  useCurrentUserId,
  useForwardGroupSheet,
  useGroupTitle,
  useIsAdmin,
  useIsWindowNarrow,
  useToast,
} from '../../ui';
import ConnectionStatus from '../../ui/components/ConnectionStatus';
import { useShipConnectionStatus } from './useShipConnectionStatus';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetails'>;

export function ChatDetailsScreen(props: Props) {
  const { chatType, chatId } = props.route.params;

  const { navigation } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();
  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);

  const handleInvitePressed = useCallback(
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
    <ForwardGroupSheetProvider>
      <ChatOptionsProvider
        key={`${chatType}-${chatId}`}
        initialChat={{
          type: chatType,
          id: chatId,
        }}
        onPressInvite={handleInvitePressed}
        {...useChatSettingsNavigation()}
      >
        <ChatDetailsScreenView />
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
    </ForwardGroupSheetProvider>
  );
}

export function ChatDetailsScreenView() {
  const {
    params: { chatType },
  } = useRoute<RootStackRouteProp<'ChatDetails'>>();
  const { channel, group } = useChatOptions();
  const {
    onPressGroupMeta: navigateToGroupMeta,
    onPressEditChannelMeta: navigateToEditChannelMeta,
  } = useChatSettingsNavigation();
  const { navigateToGroup, navigateBack } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUser);
  // Check host status for both groups and channels (channels use the group's host)
  const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
    enabled: !!group,
  });
  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';

  const handlePressEdit = useCallback(() => {
    if (chatType === 'group' && group) {
      navigateToGroupMeta(group.id);
    } else if (chatType === 'channel' && channel && channel.groupId) {
      navigateToEditChannelMeta(channel.id, channel.groupId);
    }
  }, [
    channel,
    chatType,
    group,
    navigateToEditChannelMeta,
    navigateToGroupMeta,
  ]);

  const handlePressBack = useCallback(() => {
    if (chatType === 'group' && group && !isWindowNarrow) {
      navigateToGroup(group.id);
    } else {
      navigateBack();
    }
  }, [chatType, group, navigateToGroup, navigateBack, isWindowNarrow]);

  const getTitle = () => {
    switch (chatType) {
      case 'group':
        return 'Group info & settings';
      case 'channel':
        return 'Channel info';
      default:
        return 'Info';
    }
  };

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        backAction={handlePressBack}
        useHorizontalTitleLayout={!isWindowNarrow}
        title={getTitle()}
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
      {chatType === 'channel' && channel ? (
        <ChatDetailsScreenContent
          chatType="channel"
          channel={channel}
          group={group}
          actionsEnabled={actionsEnabled}
        />
      ) : chatType === 'group' && group ? (
        <ChatDetailsScreenContent
          chatType="group"
          group={group}
          channel={channel}
          actionsEnabled={actionsEnabled}
        />
      ) : null}
    </View>
  );
}

const maxMembersToDisplay = 5;

function ChatDetailsScreenContent({
  chatType,
  channel,
  group,
  actionsEnabled = true,
}: {
  chatType: 'group' | 'channel';
  channel?: db.Channel | null;
  group?: db.Group | null;
  actionsEnabled?: boolean;
}) {
  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUser);
  const canInviteToGroup =
    ((group && currentUserIsAdmin) || group?.privacy === 'public') &&
    actionsEnabled;
  const groupTitle = useGroupTitle(group) ?? 'group';
  const members = chatType === 'group' ? group?.members : channel?.members;
  const memberCount = members?.length ?? 0;
  const title = useChatTitle(channel, group);
  const subtitle = useMemo(() => {
    if (chatType === 'group') {
      return [
        group?.privacy ? `${capitalize(group.privacy)} group` : 'Group',
        memberCount
          ? `with ${memberCount} ${pluralize(memberCount, 'member')}`
          : null,
      ]
        .filter((n) => !!n)
        .join(' ');
    }

    if (!channel) {
      return '';
    }

    switch (channel.type) {
      case 'dm':
        return `Chat with ${channel.contactId}`;
      case 'groupDm':
        return channel.members && channel.members?.length > 2
          ? `Chat with ${channel.members[0].contactId} and ${channel.members?.length - 1} others`
          : 'Group chat';
      default:
        return group
          ? group.channels?.length === 1
            ? `Group with ${group.members?.length ?? 0} members`
            : `Channel in ${groupTitle}`
          : '';
    }
  }, [channel, chatType, group, groupTitle, memberCount]);

  const insets = useSafeAreaInsets();

  return (
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
        {chatType === 'group' ? (
          <ListItem.GroupIcon testID="GroupIcon" model={group} size="$5xl" />
        ) : chatType === 'channel' && channel && group ? (
          <ListItem.GroupIcon model={group} size="$5xl" />
        ) : chatType === 'channel' && channel ? (
          <ListItem.ChannelIcon model={channel} size="$5xl" />
        ) : null}
        <YStack gap="$l" flex={1}>
          <TlonText.Text>{title}</TlonText.Text>
          <TlonText.Text size={'$label/m'} color={'$secondaryText'}>
            {subtitle}
          </TlonText.Text>
        </YStack>
      </XStack>
      {chatType === 'group' && (
        <>
          <GroupQuickActions group={group} canInvite={canInviteToGroup} />
          <GroupDescription group={group} />
          <ChatSettings
            chatType="group"
            group={group}
            actionsEnabled={actionsEnabled}
          />
        </>
      )}

      {chatType === 'channel' && channel && channel.groupId && (
        <>
          <ChannelQuickActions channel={channel} canInvite={canInviteToGroup} />
          <ChatSettings
            chatType="channel"
            channel={channel}
            group={group}
            actionsEnabled={actionsEnabled}
          />
        </>
      )}

      {members?.length ? (
        <ChatMembersList
          chatType={chatType}
          members={members}
          canInvite={canInviteToGroup}
          canManage={currentUserIsAdmin && actionsEnabled}
        />
      ) : null}

      {chatType === 'group' && group ? (
        <ChatLeaveActions chatType="group" group={group} />
      ) : null}
      {chatType === 'channel' && channel && channel.groupId && (
        <ChatLeaveActions chatType="channel" channel={channel} />
      )}
    </ScrollView>
  );
}

// Shared helper for notification title
function getNotificationTitle(
  volumeSettings: { level: ub.NotificationLevel } | null | undefined,
  baseVolumeLevel: ub.NotificationLevel
): string {
  const hasCustomSetting = !!volumeSettings?.level;

  if (hasCustomSetting && volumeSettings) {
    const levelName = ub.NotificationNamesShort[volumeSettings.level];
    return `${levelName} (custom)`;
  }

  const defaultLevelName = ub.NotificationNamesShort[baseVolumeLevel];
  return `${defaultLevelName} (app default)`;
}

// Unified ChatSettings component for both groups and channels
interface ChatSettingsProps {
  chatType: 'group' | 'channel';
  group?: db.Group | null;
  channel?: db.Channel | null;
  actionsEnabled: boolean;
}

function ChatSettings({
  chatType,
  group,
  channel,
  actionsEnabled,
}: ChatSettingsProps) {
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
    onPressEditChannelPrivacy,
  } = useChatSettingsNavigation();

  const baseVolumeLevel = store.useBaseVolumeLevel();

  // Get volume settings from the appropriate source
  const volumeSettings =
    chatType === 'group' ? group?.volumeSettings : channel?.volumeSettings;

  const notificationTitle = useMemo(
    () => getNotificationTitle(volumeSettings, baseVolumeLevel),
    [volumeSettings, baseVolumeLevel]
  );

  // Group-specific handlers
  const handlePressGroupPrivacy = useCallback(() => {
    if (group) {
      onPressGroupPrivacy?.(group.id);
    }
  }, [group, onPressGroupPrivacy]);

  const handlePressManageChannels = useCallback(() => {
    if (group) {
      onPressManageChannels?.(group.id);
    }
  }, [group, onPressManageChannels]);

  const handlePressRoles = useCallback(() => {
    if (group) {
      onPressRoles?.(group.id);
    }
  }, [group, onPressRoles]);

  // Channel-specific handlers
  const handlePressEditChannelPrivacy = useCallback(() => {
    if (channel?.groupId) {
      onPressEditChannelPrivacy(channel.id, channel.groupId);
    }
  }, [channel, onPressEditChannelPrivacy]);

  // Shared handler
  const handlePressNotificationSettings = useCallback(() => {
    if (chatType === 'group' && group) {
      onPressChatVolume({ type: 'group', id: group.id });
    } else if (chatType === 'channel' && channel) {
      onPressChatVolume({ type: 'channel', id: channel.id });
    }
  }, [chatType, group, channel, onPressChatVolume]);

  const actions = useMemo(() => {
    // Common notification action for all users
    const notificationAction: SettingsActionProps = {
      title: 'Notifications',
      description: notificationTitle,
      testID:
        chatType === 'group' ? 'GroupNotifications' : 'ChannelNotifications',
      disabled: false,
      onPress: handlePressNotificationSettings,
    };

    if (!currentUserIsAdmin) {
      return [notificationAction];
    }

    // Admin-only actions differ by chat type
    if (chatType === 'group' && group) {
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
          endValue: `${groupRoles?.length ?? 0}`,
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

    if (chatType === 'channel' && channel) {
      const isPrivate =
        (channel.readerRoles?.length ?? 0) > 0 ||
        (channel.writerRoles?.length ?? 0) > 0;
      return [
        {
          title: 'Privacy',
          endValue: isPrivate ? 'Private' : 'Public',
          testID: 'ChannelPrivacy',
          disabled: !actionsEnabled,
          onPress: handlePressEditChannelPrivacy,
        },
        notificationAction,
      ];
    }

    return [notificationAction];
  }, [
    chatType,
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
    groupRoles?.length,
  ]);

  return (
    <View paddingHorizontal={'$l'}>
      <ActionSheet.ActionGroup
        padding={0}
        contentProps={{
          backgroundColor: '$background',
          borderRadius: '$2xl',
          borderWidth: 0,
        }}
      >
        {chatType === 'group' && group && (
          <ConnectionStatus contactId={group.hostUserId} type="action" />
        )}
        {actions.map((action, index) => (
          <SettingsAction
            key={index}
            {...action}
            first={index === 0}
            last={index === actions.length - 1}
          />
        ))}
      </ActionSheet.ActionGroup>
    </View>
  );
}

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

// Unified ChatLeaveActions component for both groups and channels
interface ChatLeaveActionsProps {
  chatType: 'group' | 'channel';
  group?: db.Group;
  channel?: db.Channel;
}

function ChatLeaveActions({ chatType, group, channel }: ChatLeaveActionsProps) {
  const { onLeaveGroup, onLeaveChannel } = useChatSettingsNavigation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { leaveGroup, leaveChannel } = useChatOptions();

  const { deleteGroup: deleteGroupFromContext } = useGroupContext({
    groupId: group?.id ?? '',
  });

  // Always call hooks unconditionally
  const groupTitle = useGroupTitle(group);

  // Determine host status and permissions
  const isHost =
    chatType === 'group'
      ? group?.currentUserIsHost
      : channel?.currentUserIsHost ?? false;
  const canLeave = !isHost;
  const canDelete = isHost;

  // Get title for dialogs
  const chatTitle =
    chatType === 'group' ? groupTitle ?? 'group' : channel?.title ?? 'channel';

  const handleLeaveWithConfirm = useCallback(async () => {
    if (chatType === 'group') {
      const message = `You will no longer receive updates from this group.\n\nWarning: Leaving this group will invalidate any invitations you've sent.`;

      if (isWeb) {
        const confirmed = window.confirm(`Leave ${chatTitle}?\n\n${message}`);
        if (confirmed) {
          await leaveGroup();
        }
      } else {
        Alert.alert(`Leave ${chatTitle}?`, message, [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Leave Group',
            style: 'destructive',
            onPress: leaveGroup,
          },
        ]);
      }
    } else {
      await leaveChannel();
    }
  }, [chatType, chatTitle, leaveGroup, leaveChannel]);

  const handleDelete = useCallback(async () => {
    if (chatType === 'group') {
      deleteGroupFromContext();
      onLeaveGroup();
    } else if (channel?.groupId) {
      try {
        await store.deleteChannel({
          channelId: channel.id,
          groupId: channel.groupId,
        });
        await onLeaveChannel(channel.groupId, channel.id);
      } catch (error) {
        console.error('Failed to delete channel:', error);
        if (isWeb) {
          window.alert('Failed to delete channel. Please try again.');
        } else {
          Alert.alert('Error', 'Failed to delete channel. Please try again.');
        }
      }
    }
  }, [chatType, channel, deleteGroupFromContext, onLeaveGroup, onLeaveChannel]);

  const leaveActions = createActionGroup(
    'negative',
    canLeave && {
      title: chatType === 'group' ? 'Leave group' : 'Leave channel',
      action: handleLeaveWithConfirm,
    },
    canDelete && {
      title: chatType === 'group' ? 'Delete group' : 'Delete channel',
      action: () => setShowDeleteDialog(true),
    }
  );

  if (leaveActions.actions.length === 0) {
    return null;
  }

  const deleteDescription =
    chatType === 'group'
      ? 'This action cannot be undone.'
      : 'This action cannot be undone. All messages in this channel will be permanently deleted.';

  return (
    <View paddingHorizontal={'$l'}>
      <ActionSheet.ActionGroup
        padding={0}
        contentProps={{ borderRadius: '$2xl' }}
        accent="negative"
      >
        {leaveActions.actions.map((action, i) => (
          <ActionSheet.Action
            key={i}
            action={action}
            testID={`${chatType === 'group' ? 'Group' : 'Channel'}LeaveAction-${action.title}`}
          />
        ))}
      </ActionSheet.ActionGroup>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete ${chatTitle}?`}
        description={deleteDescription}
        confirmText={chatType === 'group' ? 'Delete group' : 'Delete channel'}
        cancelText="Cancel"
        onConfirm={handleDelete}
        destructive
      />
    </View>
  );
}

function ChatMembersList({
  chatType,
  members,
  canInvite,
  canManage,
}: {
  chatType: 'group' | 'channel';
  members?: db.ChatMember[] | null;
  canInvite: boolean;
  canManage: boolean;
}) {
  const joinedMembers = members?.filter((m) => m.status === 'joined');
  const memberCount = joinedMembers?.length ?? 0;
  const { onPressGroupMembers, onPressChannelMembers, onPressInvite } =
    useChatOptions();

  const handlePressSeeAllMembers = useCallback(() => {
    if (chatType === 'group') {
      onPressGroupMembers();
    } else {
      onPressChannelMembers();
    }
  }, [chatType, onPressChannelMembers, onPressGroupMembers]);

  return (
    <View paddingHorizontal={'$l'}>
      <PaddedBlock width="100%" gap="$l" paddingBottom="$xl">
        <TlonText.Text size="$label/xl" color="$tertiaryText">
          {memberCount} {pluralize(memberCount, 'Member')}
        </TlonText.Text>
        <YStack>
          {canInvite ? (
            <Pressable onPress={onPressInvite}>
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
            .map((member: db.ChatMember) => {
              return (
                <ContactListItem
                  size="$3xl"
                  height="auto"
                  padding={0}
                  showNickname
                  key={member.contactId}
                  contactId={member.contactId}
                />
              );
            })}
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
                  {canManage ? 'Manage members' : 'See all '}
                </TlonText.Text>
                <Icon type="ChevronRight" color="$tertiaryText" />
              </XStack>
            </Pressable>
          )}
        </YStack>
      </PaddedBlock>
    </View>
  );
}

function GroupQuickActions({
  group,
  canInvite,
}: {
  group: db.Group;
  canInvite?: boolean;
}) {
  const { markGroupRead, togglePinned } = useChatOptions();
  const forwardGroupSheet = useForwardGroupSheet();
  const { onPressInvite } = useChatOptions();
  const isPinned = group?.pin;
  const canMarkRead = !(group.unread?.count === 0);
  const toast = useToast();

  const handleForwardGroup = useCallback(() => {
    forwardGroupSheet.open(group);
  }, [forwardGroupSheet, group]);

  const handleCopyShortcode = useCallback(() => {
    Clipboard.setString(group.id);
    toast({ message: 'Copied!', duration: 1500 });
  }, [group.id, toast]);

  const heroActions = useMemo(
    () =>
      createActionGroup(
        'neutral',
        canInvite && {
          title: 'Invite',
          action: onPressInvite,
        }
      ),
    [canInvite, onPressInvite]
  );

  const secondaryActions = useMemo(
    () =>
      createActionGroup(
        'neutral',
        canMarkRead && {
          title: 'Mark read',
          disabled: !canMarkRead,
          action: markGroupRead,
        },
        {
          title: isPinned ? 'Unpin' : 'Pin',
          endIcon: 'Pin',
          action: togglePinned,
        },
        {
          title: 'Forward reference',
          action: handleForwardGroup,
        },
        {
          title: 'Copy group ID',
          action: handleCopyShortcode,
        }
      ),
    [
      canMarkRead,
      isPinned,
      handleCopyShortcode,
      handleForwardGroup,
      markGroupRead,
      togglePinned,
    ]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      width={'100%'}
      paddingLeft={'$l'}
    >
      {heroActions.actions.map((action, i) => (
        <ProfileButton
          key={i}
          title={action.title}
          onPress={action.action}
          disabled={action.disabled}
          testID={`GroupQuickAction-${action.title}`}
          hero
        />
      ))}
      {secondaryActions.actions.map((action, i) => (
        <ProfileButton
          key={i}
          title={action.title}
          onPress={action.action}
          disabled={action.disabled}
          testID={`GroupQuickAction-${action.title}`}
        />
      ))}
    </ScrollView>
  );
}

const GroupDescription = ({ group }: { group: db.Group }) => {
  if (!group.description) {
    return null;
  }

  return (
    <View paddingHorizontal={'$l'}>
      <PaddedBlock width="100%" gap="$xl">
        <TlonText.Text size="$label/m" color="$tertiaryText">
          Description
        </TlonText.Text>
        <TlonText.Text size="$body" color="$primaryText">
          {group.description}
        </TlonText.Text>
      </PaddedBlock>
    </View>
  );
};

function ChannelQuickActions({
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
