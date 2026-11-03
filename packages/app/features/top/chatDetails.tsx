// Wires the group and channel info screen to the app: its data, where its
// rows lead, and what its actions do. `ChatDetailsScreenView` draws it.
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { useChatSettingsNavigation } from '../../hooks/useChatSettingsNavigation';
import { useGroupContext } from '../../hooks/useGroupContext';
import { useRootNavigation } from '../../navigation/utils';
import {
  GroupMemberProfileSheet,
  useChatOptions,
  useCurrentUserId,
  useForwardChannelSheet,
  useForwardGroupSheet,
  useGroupTitle,
  useIsAdmin,
  useToast,
} from '../../ui';
import { ChatDetailsScreenView } from '../../ui/components/ChatDetailsScreenView';
import { useCopyChannelLink } from '../../ui/hooks/useCopyChannelLink';
import {
  WorkspaceInstructionsSheet,
  hasWorkspaceInstructions,
} from '../../ui/components/WorkspaceInstructionsSheet';
import {
  destinationForChannel,
  tasksPostingTo,
} from '../../ui/components/automationTaskDraft';
import { useBotDelivery } from '../automations/useBotDelivery';
import {
  useOpenScheduledTasks,
  useScheduledTasksEntry,
} from '../automations/useScheduledTasksEntry';
import { useShipConnectionStatus } from './useShipConnectionStatus';

type ChatType = 'group' | 'channel';

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
  const {
    channel,
    group,
    markGroupRead,
    togglePinned,
    onPressInvite,
    onPressGroupMembers,
    onPressChannelMembers,
    leaveGroup,
    leaveChannel,
  } = useChatOptions();
  const {
    onPressGroupPrivacy,
    onPressManageChannels,
    onPressChatVolume,
    onPressRoles,
    onLeaveGroup,
    onLeaveChannel,
  } = useChatSettingsNavigation();
  const { navigation, resetToDm } = useRootNavigation();
  const forwardGroupSheet = useForwardGroupSheet();
  const forwardChannelSheet = useForwardChannelSheet();
  const toast = useToast();

  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(group?.id ?? '', currentUserId);
  const hostStatus = useShipConnectionStatus(group?.hostUserId || '', {
    enabled: !!group,
  });
  const { groupRoles, deleteGroup } = useGroupContext({
    groupId: group?.id ?? '',
  });
  const groupTitle = useGroupTitle(group) ?? 'workspace';
  const scheduledTasks = useScheduledTasksHere({ chatType, channel, group });
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  // Bots honor a workspace config only in groups their owner hosts, so
  // only the host gets the editor.
  const supportsInstructions =
    store.useDeskSupportsStewardBots() === true &&
    group?.hostUserId === currentUserId;
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const handlePressProfile = useCallback(
    (contactId: string) => {
      navigation.navigate('UserProfile', { userId: contactId });
    },
    [navigation]
  );

  const handleForward = useCallback(() => {
    if (group) {
      forwardGroupSheet.open(group);
    }
  }, [forwardGroupSheet, group]);

  const copyText = useCallback(
    async (text: string) => {
      await Clipboard.setStringAsync(text);
      toast({ message: 'Copied!', duration: 1500 });
    },
    [toast]
  );

  const handleCopyGroupId = useCallback(() => {
    if (group) {
      copyText(group.id);
    }
  }, [copyText, group]);

  // DMs have no nest, so only group channels can be referenced.
  const canReference = chatType === 'channel' && !!channel?.groupId;

  const handleForwardChannel = useCallback(() => {
    if (channel) {
      forwardChannelSheet.open(channel);
    }
  }, [forwardChannelSheet, channel]);

  const handleCopyChannelLink = useCopyChannelLink(channel?.id ?? '');

  const handlePressNotifications = useCallback(() => {
    if (chatType === 'group' && group) {
      onPressChatVolume({ type: 'group', id: group.id, groupId: group.id });
    } else if (chatType === 'channel' && channel) {
      onPressChatVolume({
        type: 'channel',
        id: channel.id,
        groupId: channel.groupId ?? undefined,
      });
    }
  }, [chatType, group, channel, onPressChatVolume]);

  const handleLeave = useCallback(async () => {
    if (chatType !== 'group') {
      await leaveChannel();
      return;
    }
    const message = `You will no longer receive updates from this workspace.\n\nWarning: Leaving this workspace will invalidate any invitations you've sent.`;
    if (isWeb) {
      if (window.confirm(`Leave ${groupTitle}?\n\n${message}`)) {
        await leaveGroup();
      }
    } else {
      Alert.alert(`Leave ${groupTitle}?`, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Workspace',
          style: 'destructive',
          onPress: leaveGroup,
        },
      ]);
    }
  }, [chatType, groupTitle, leaveGroup, leaveChannel]);

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

  return (
    <ChatDetailsScreenView
      chatType={chatType}
      group={group}
      channel={channel}
      currentUserId={currentUserId}
      currentUserIsAdmin={currentUserIsAdmin}
      hostStatus={hostStatus}
      roleCount={(groupRoles?.length ?? 0) + 1}
      scheduledTaskCount={scheduledTasks.count}
      onGoBack={onGoBack}
      onPressEdit={onPressEdit}
      onPressInvite={onPressInvite}
      onMarkRead={markGroupRead}
      onTogglePinned={togglePinned}
      onForward={handleForward}
      onCopyGroupId={handleCopyGroupId}
      onForwardChannel={canReference ? handleForwardChannel : undefined}
      onCopyChannelLink={canReference ? handleCopyChannelLink : undefined}
      onCopyText={copyText}
      onPressPrivacy={() => group && onPressGroupPrivacy(group.id, true)}
      onPressRoles={() => group && onPressRoles(group.id, true)}
      onPressChannels={() => group && onPressManageChannels(group.id, true)}
      instructions={
        supportsInstructions && group
          ? hasWorkspaceInstructions(group)
            ? 'On'
            : 'Off'
          : undefined
      }
      onPressInstructions={() => setInstructionsOpen(true)}
      onPressNotifications={handlePressNotifications}
      onPressScheduledTasks={scheduledTasks.open}
      onPressChannelPermissions={() =>
        channel?.groupId && onEditChannelPrivacy(channel.id, channel.groupId)
      }
      onPressProfile={handlePressProfile}
      onMessageContact={resetToDm}
      onPressMember={setSelectedContact}
      onPressAllMembers={
        chatType === 'group' ? onPressGroupMembers : onPressChannelMembers
      }
      onLeave={handleLeave}
      onDelete={handleDelete}
    >
      {chatType === 'group' && group ? (
        <GroupMemberProfileSheet
          selectedContact={selectedContact}
          onDismiss={() => setSelectedContact(null)}
          groupId={group.id}
          onPressGoToProfile={handlePressProfile}
        />
      ) : null}
      {instructionsOpen && group ? (
        <WorkspaceInstructionsSheet
          group={group}
          onClose={() => setInstructionsOpen(false)}
        />
      ) : null}
    </ChatDetailsScreenView>
  );
}

/**
 * The bot's scheduled tasks that post into this group or channel. Anyone with
 * a bot can see them, admin or not. There is a count once the bot has
 * something scheduled here or could be given something: in a group, as a
 * member with a channel to post in; in a channel, where it may write.
 */
function useScheduledTasksHere({
  chatType,
  channel,
  group,
}: {
  chatType: ChatType;
  channel?: db.Channel | null;
  group?: db.Group | null;
}): { count: number | undefined; open: () => void } {
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
  const taskCount = useMemo(
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
  const shows =
    scheduledTasks.visible &&
    taskCount !== undefined &&
    (taskCount > 0 || botCouldPostHere);

  const { botShip } = scheduledTasks;
  const open = useCallback(() => {
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

  return { count: shows ? taskCount : undefined, open };
}
