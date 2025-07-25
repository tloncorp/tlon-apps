import { useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as db from '@tloncorp/shared/db';
import { capitalize } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { RootStackParamList, RootStackRouteProp } from '../../navigation/types';
import { useRootNavigation } from '../../navigation/utils';
import {
  ActionSheet,
  ChatOptionsProvider,
  ConnectionStatusComponent,
  ContactListItem,
  DeleteSheet,
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
  notificationOptions,
  pluralize,
  useChatOptions,
  useChatTitle,
  useCurrentUserId,
  useForwardGroupSheet,
  useGroupTitle,
  useIsAdmin,
  useIsWindowNarrow,
} from '../../ui';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetails'>;

export function ChatDetailsScreen(props: Props) {
  const { chatType, chatId } = props.route.params;

  const [inviteSheetGroup, setInviteSheetGroup] = useState<string | null>(null);
  const handleInvitePressed = useCallback((group: string) => {
    setInviteSheetGroup(group);
  }, []);

  const handleInviteSheetOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setInviteSheetGroup(null);
    }
  }, []);

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
        <InviteUsersSheet
          open={inviteSheetGroup !== null}
          onOpenChange={handleInviteSheetOpenChange}
          onInviteComplete={() => setInviteSheetGroup(null)}
          groupId={inviteSheetGroup ?? undefined}
        />
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
        backAction={handlePressBack}
        title={chatType === 'group' ? 'Group info' : 'Channel info'}
        rightControls={
          currentUserIsAdmin ? (
            <ScreenHeader.TextButton onPress={handlePressEdit}>
              Edit
            </ScreenHeader.TextButton>
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
}:
  | { chatType: 'group'; channel?: db.Channel | null; group: db.Group }
  | { chatType: 'channel'; channel: db.Channel; group?: db.Group | null }) {
  const currentUser = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUser);
  const canInviteToGroup =
    (group && currentUserIsAdmin) || group?.privacy === 'public';
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
        padding: '$l',
        paddingTop: '$xl',
        paddingBottom: insets.bottom,
        gap: '$3xl',
        flexDirection: 'column',
      }}
    >
      <ListItem alignItems="center" gap="$xl">
        {chatType === 'group' ? (
          <ListItem.GroupIcon model={group} size="$5xl" />
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

      <YStack gap="$l">
        {chatType === 'group' && <GroupQuickActions group={group} />}
        {chatType === 'group' && (
          <GroupSettings group={group} channel={channel ?? undefined} />
        )}

        {members?.length ? (
          <ChatMembersList
            chatType={chatType}
            members={members}
            canInvite={canInviteToGroup}
            canManage={currentUserIsAdmin}
          />
        ) : null}

        {group ? <GroupLeaveActions group={group} /> : null}
      </YStack>
    </ScrollView>
  );
}

function GroupLeaveActions({ group }: { group: db.Group }) {
  const { onLeaveGroup } = useChatSettingsNavigation();
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const canLeave = !group.currentUserIsHost;
  const canDelete = group.currentUserIsHost;
  const groupTitle = useGroupTitle(group) ?? 'group';

  const { deleteGroup } = useGroupContext({
    groupId: group.id,
  });

  const { leaveGroup } = useChatOptions();

  const leaveActions = createActionGroup(
    'negative',
    canLeave && {
      title: 'Leave group',
      action: leaveGroup,
    },
    canDelete && {
      title: 'Delete group',
      action: () => setShowDeleteSheet(true),
    }
  );

  const handleDeleteGroup = useCallback(() => {
    deleteGroup();
    onLeaveGroup();
  }, [deleteGroup, onLeaveGroup]);

  return (
    <>
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
      <DeleteSheet
        title={groupTitle ?? 'This group'}
        itemTypeDescription="group"
        open={showDeleteSheet}
        onOpenChange={setShowDeleteSheet}
        deleteAction={handleDeleteGroup}
      />
    </>
  );
}

function GroupSettings({
  group,
  channel,
}: {
  group: db.Group;
  channel?: db.Channel;
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

  return (
    <ActionSheet.ActionGroup
      padding={0}
      contentProps={{
        backgroundColor: '$background',
        borderRadius: '$2xl',
        borderWidth: 0,
      }}
    >
      {group?.hostUserId && (
        <ConnectionStatusComponent 
          contactId={group.hostUserId}
          label="Connected to Group Host"
        />
      )}
      {channel?.contactId && channel.contactId !== group?.hostUserId && (
        <ConnectionStatusComponent 
          contactId={channel.contactId}
          label="Connected to Channel Host"
        />
      )}
      {currentUserIsAdmin ? (
        <Pressable onPress={handlePressGroupPrivacy}>
          <ListItem
            paddingHorizontal="$2xl"
            backgroundColor={'$background'}
            borderRadius="$2xl"
            testID="GroupPrivacy"
          >
            <ActionSheet.MainContent>
              <ActionSheet.ActionTitle>Privacy</ActionSheet.ActionTitle>
            </ActionSheet.MainContent>
            <ListItem.EndContent
              flexDirection="row"
              gap="$xl"
              alignItems="center"
            >
              <ListItem.Title color="$tertiaryText">
                {capitalize(group?.privacy ?? '')}
              </ListItem.Title>
              <ActionSheet.ActionIcon
                type="ChevronRight"
                color="$tertiaryText"
              />
            </ListItem.EndContent>
          </ListItem>
        </Pressable>
      ) : null}
      {currentUserIsAdmin ? (
        <Pressable onPress={handlePressRoles}>
          <ListItem
            paddingHorizontal="$2xl"
            backgroundColor={'$background'}
            borderRadius="$2xl"
            testID="GroupRoles"
          >
            <ActionSheet.MainContent>
              <ActionSheet.ActionTitle>Roles</ActionSheet.ActionTitle>
            </ActionSheet.MainContent>
            <ListItem.EndContent
              flexDirection="row"
              gap="$xl"
              alignItems="center"
            >
              <ListItem.Title color="$tertiaryText">
                {groupRoles?.length ?? 0}
              </ListItem.Title>
              <ActionSheet.ActionIcon
                type="ChevronRight"
                color="$tertiaryText"
              />
            </ListItem.EndContent>
          </ListItem>
        </Pressable>
      ) : null}
      {currentUserIsAdmin ? (
        <Pressable onPress={handlePressManageChannels}>
          <ListItem
            paddingHorizontal="$2xl"
            backgroundColor={'$background'}
            borderRadius="$2xl"
            testID="GroupChannels"
          >
            <ActionSheet.MainContent>
              <ActionSheet.ActionTitle>Channels</ActionSheet.ActionTitle>
            </ActionSheet.MainContent>
            <ListItem.EndContent
              flexDirection="row"
              alignItems="center"
              gap="$xl"
            >
              <ListItem.Title color="$tertiaryText">
                {channelCount}
              </ListItem.Title>
              <ActionSheet.ActionIcon
                type="ChevronRight"
                color="$tertiaryText"
              />
            </ListItem.EndContent>
          </ListItem>
        </Pressable>
      ) : null}
      <Pressable onPress={handlePressNotificationSettings}>
        <ListItem
          paddingHorizontal="$2xl"
          backgroundColor={'$background'}
          borderRadius="$2xl"
          alignItems="center"
          testID="GroupNotifications"
        >
          <ActionSheet.MainContent>
            <ActionSheet.ActionTitle>Notifications</ActionSheet.ActionTitle>
          </ActionSheet.MainContent>
          <ListItem.EndContent
            flexDirection="row"
            gap="$xl"
            alignItems="center"
            justifyContent="flex-end"
            flex={1}
          >
            <ListItem.Title color="$tertiaryText">
              {
                notificationOptions.find(
                  (o) => o.value === group?.volumeSettings?.level
                )?.title
              }
            </ListItem.Title>
            <ActionSheet.ActionIcon type="ChevronRight" color="$tertiaryText" />
          </ListItem.EndContent>
        </ListItem>
      </Pressable>
    </ActionSheet.ActionGroup>
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
  );
}

function GroupQuickActions({ group }: { group: db.Group }) {
  const { markGroupRead, togglePinned } = useChatOptions();
  const forwardGroupSheet = useForwardGroupSheet();

  const isPinned = group?.pin;
  const canMarkRead = !(group.unread?.count === 0);

  const handleForwardGroup = useCallback(() => {
    forwardGroupSheet.open(group);
  }, [forwardGroupSheet, group]);

  const actions = useMemo(
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
          title: 'Forward',
          action: handleForwardGroup,
        }
      ),
    [canMarkRead, markGroupRead, isPinned, togglePinned, handleForwardGroup]
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      width={'100%'}
    >
      {actions.actions.map((action, i) => (
        <ProfileButton
          key={i}
          title={action.title}
          onPress={action.action}
          disabled={action.disabled}
          secondary
        />
      ))}
    </ScrollView>
  );
}
