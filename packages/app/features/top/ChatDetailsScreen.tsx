import Clipboard from '@react-native-clipboard/clipboard';
import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
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
  useNotificationLevelOptions,
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
    onPressChannelMeta: navigateToChannelMeta,
  } = useChatSettingsNavigation();
  const { navigateToGroup, navigateBack } = useRootNavigation();
  const isWindowNarrow = useIsWindowNarrow();

  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUser);
  const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
    enabled: chatType === 'group' && !!group,
  });
  const actionsEnabled =
    currentUserIsAdmin && hostStatus.complete && hostStatus.status === 'yes';

  const handlePressEdit = useCallback(() => {
    if (chatType === 'group' && group) {
      navigateToGroupMeta(group.id);
    } else if (chatType === 'channel' && channel) {
      navigateToChannelMeta(channel.id);
    }
  }, [channel, chatType, group, navigateToChannelMeta, navigateToGroupMeta]);

  const handlePressBack = useCallback(() => {
    if (chatType === 'group' && group && !isWindowNarrow) {
      navigateToGroup(group.id);
    } else {
      navigateBack();
    }
  }, [chatType, group, navigateToGroup, navigateBack, isWindowNarrow]);

  return (
    <View flex={1} backgroundColor="$secondaryBackground">
      <ScreenHeader
        backgroundColor="$secondaryBackground"
        backAction={handlePressBack}
        useHorizontalTitleLayout={!isWindowNarrow}
        title={chatType === 'group' ? 'Group info & settings' : 'Channel info'}
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
        <ChatDetailsScreenContent chatType="channel" channel={channel} />
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
}:
  | {
      chatType: 'group';
      channel?: db.Channel | null;
      group: db.Group;
      actionsEnabled?: boolean;
    }
  | {
      chatType: 'channel';
      channel: db.Channel;
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
        paddingBottom: insets.bottom + getTokenValue('$3xl'),
      }}
    >
      <ListItem alignItems="center" gap="$xl" paddingHorizontal="$xl">
        {chatType === 'group' ? (
          <ListItem.GroupIcon testID="GroupIcon" model={group} size="$5xl" />
        ) : (
          <ListItem.ChannelIcon model={channel} size="$5xl" />
        )}
        <ListItem.MainContent>
          <ListItem.Title fontSize={24} lineHeight={24}>
            {title}
          </ListItem.Title>
          <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
      </ListItem>

      {chatType === 'group' && (
        <GroupQuickActions group={group} canInvite={canInviteToGroup} />
      )}
      {chatType === 'group' && (
        <GroupSettings group={group} actionsEnabled={actionsEnabled} />
      )}

      {members?.length ? (
        <ChatMembersList
          chatType={chatType}
          members={members}
          canInvite={canInviteToGroup}
          canManage={currentUserIsAdmin && actionsEnabled}
        />
      ) : null}

      {group ? <GroupLeaveActions group={group} /> : null}
    </ScrollView>
  );
}

function GroupLeaveActions({ group }: { group: db.Group }) {
  const { onLeaveGroup } = useChatSettingsNavigation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const canLeave = !group.currentUserIsHost;
  const canDelete = group.currentUserIsHost;
  const groupTitle = useGroupTitle(group) ?? 'group';

  const { deleteGroup } = useGroupContext({
    groupId: group.id,
  });

  const { leaveGroup } = useChatOptions();

  const handleLeaveGroupWithConfirm = useCallback(async () => {
    const message = `You will no longer receive updates from this group.\n\nWarning: Leaving this group will invalidate any invitations you've sent.`;

    if (isWeb) {
      const confirmed = window.confirm(`Leave ${groupTitle}?\n\n${message}`);
      if (confirmed) {
        await leaveGroup();
      }
    } else {
      Alert.alert(`Leave ${groupTitle}?`, message, [
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
  }, [groupTitle, leaveGroup]);

  const leaveActions = createActionGroup(
    'negative',
    canLeave && {
      title: 'Leave group',
      action: handleLeaveGroupWithConfirm,
    },
    canDelete && {
      title: 'Delete group',
      action: () => setShowDeleteDialog(true),
    }
  );

  const handleDeleteGroup = useCallback(() => {
    deleteGroup();
    onLeaveGroup();
  }, [deleteGroup, onLeaveGroup]);

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
            testID={`GroupLeaveAction-${action.title}`}
          />
        ))}
      </ActionSheet.ActionGroup>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={`Delete ${groupTitle ?? 'This group'}?`}
        description="This action cannot be undone."
        confirmText="Delete group"
        cancelText="Cancel"
        onConfirm={handleDeleteGroup}
        destructive
      />
    </View>
  );
}

function GroupSettings({
  group,
  actionsEnabled,
}: {
  group: db.Group;
  actionsEnabled: boolean;
}) {
  const channelCount = group.channels?.length ?? 0;

  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group.id, currentUserId);

  const { groupRoles } = useGroupContext({
    groupId: group.id,
  });

  const {
    onPressGroupPrivacy,
    onPressManageChannels,
    onPressChatVolume,
    onPressRoles,
  } = useChatSettingsNavigation();

  const notificationOptions = useNotificationLevelOptions({
    includeLoud: true,
    shortDescriptions: true,
  });

  const handlePressGroupPrivacy = useCallback(() => {
    onPressGroupPrivacy?.(group.id);
  }, [group.id, onPressGroupPrivacy]);

  const handlePressManageChannels = useCallback(() => {
    onPressManageChannels?.(group.id);
  }, [group.id, onPressManageChannels]);

  const handlePressNotificationSettings = useCallback(() => {
    onPressChatVolume({ type: 'group', id: group.id });
  }, [group.id, onPressChatVolume]);

  const handlePressRoles = useCallback(() => {
    onPressRoles?.(group.id);
  }, [group.id, onPressRoles]);

  const actions = useMemo(() => {
    const actionList: GroupSettingsActionProps[] = [
      {
        title: 'Notifications',
        description: notificationOptions.find(
          (o) => o.value === group?.volumeSettings?.level
        )?.title,
        testID: 'GroupNotifications',
        disabled: false,
        onPress: handlePressNotificationSettings,
      },
    ];

    if (!currentUserIsAdmin) {
      return actionList;
    }

    return (
      [
        {
          title: 'Privacy',
          description: capitalize(group?.privacy ?? ''),
          testID: 'GroupPrivacy',
          disabled: !actionsEnabled,
          onPress: handlePressGroupPrivacy,
        },
        {
          title: 'Roles',
          description: `${groupRoles?.length ?? 0}`,
          testID: 'GroupRoles',
          disabled: !actionsEnabled,
          onPress: handlePressRoles,
        },
        {
          title: 'Channels',
          description: `${channelCount}`,
          testID: 'GroupChannels',
          disabled: !actionsEnabled,
          onPress: handlePressManageChannels,
        },
      ] as GroupSettingsActionProps[]
    ).concat(actionList);
  }, [currentUserIsAdmin, actionsEnabled]);

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
        <ConnectionStatus contactId={group.hostUserId} type="list-item" />
        {actions.map((action, index) => (
          <GroupSettingsAction
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

interface GroupSettingsActionProps {
  title: string | React.ReactNode;
  description?: string;
  disabled: boolean;
  testID: string;
  first?: boolean;
  last?: boolean;
  onPress: () => void;
}

function GroupSettingsAction({
  title,
  description,
  disabled,
  testID,
  first,
  last,
  onPress,
}: GroupSettingsActionProps) {
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
        <ActionSheet.ActionContent>
          <ActionSheet.ActionTitle
            color={disabled ? '$tertiaryText' : undefined}
          >
            {title}
          </ActionSheet.ActionTitle>
        </ActionSheet.ActionContent>
        <ListItem.EndContent
          flexDirection="row"
          gap="$xl"
          alignItems="center"
          justifyContent="flex-end"
          flex={1}
        >
          {description && (
            <ListItem.Title color="$tertiaryText">{description}</ListItem.Title>
          )}
          {!disabled && (
            <ActionSheet.ActionIcon type="ChevronRight" color="$tertiaryText" />
          )}
        </ListItem.EndContent>
      </ListItem>
    </Pressable>
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
          secondary
        />
      ))}
    </ScrollView>
  );
}
