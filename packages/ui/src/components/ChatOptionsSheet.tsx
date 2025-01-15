import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Popover, isWeb } from 'tamagui';

import { ChevronLeft } from '../assets/icons';
import { useCurrentUserId } from '../contexts/appDataContext';
import { useChatOptions } from '../contexts/chatOptions';
import useIsWindowNarrow from '../hooks/useIsWindowNarrow';
import * as utils from '../utils';
import { useIsAdmin } from '../utils';
import {
  Action,
  ActionGroup,
  ActionSheet,
  createActionGroups,
} from './ActionSheet';
import { IconButton } from './IconButton';
import { ListItem } from './ListItem';

type ChatOptionsSheetProps = {
  // Make open/onOpenChange optional since we can use context
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  chat?: {
    type: 'group' | 'channel';
    id: string;
  } | null;
  trigger?: React.ReactNode;
};

export const ChatOptionsSheet = React.memo(function ChatOptionsSheet({
  chat,
  open: propOpen,
  onOpenChange: propOnOpenChange,
  trigger,
}: ChatOptionsSheetProps) {
  const context = useChatOptions();
  const { group } = context;

  // Use props for explicit control (popovers)
  // For sheets, this will be false and context.open will handle state
  const isOpen = propOpen ?? false;

  // Handle open state changes
  const handleOpenChange = useCallback(
    (open: boolean) => {
      console.log('ChatOptionsSheet handleOpenChange', open);
      if (open && chat) {
        // Set chat state for both popovers and sheets
        context.open(chat.id, chat.type);
      } else if (!open) {
        // Close both popover and sheet states
        if (propOnOpenChange) {
          propOnOpenChange(false);
        }
        // Clear chat state after a short delay to allow handlers to complete
        setTimeout(() => {
          context.setChat(null);
        }, 100);
      }

      // Call provided handler for popovers
      if (propOnOpenChange) {
        propOnOpenChange(open);
      }
    },
    [chat, context.open, context.setChat, propOnOpenChange]
  );

  if (!chat || (!isOpen && !trigger)) {
    return null;
  }

  if (chat.type === 'group') {
    return (
      <GroupOptionsSheetLoader
        groupId={chat.id}
        open={isOpen}
        onOpenChange={handleOpenChange}
        trigger={trigger}
      />
    );
  } else if (group?.id && group?.channels?.length === 1) {
    return (
      <GroupOptionsSheetLoader
        groupId={group.id}
        open={isOpen}
        onOpenChange={handleOpenChange}
        trigger={trigger}
      />
    );
  }

  return (
    <ChannelOptionsSheetLoader
      channelId={chat.id}
      open={isOpen}
      onOpenChange={handleOpenChange}
      trigger={trigger}
    />
  );
});

export function GroupOptionsSheetLoader({
  groupId,
  open,
  onOpenChange,
  trigger,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [pane, setPane] = useState<
    'initial' | 'notifications' | 'sort' | 'edit'
  >('initial');
  const { group } = useChatOptions();

  const handlePressNotifications = useCallback(() => {
    setPane('notifications');
  }, [setPane]);

  const handlePressSort = useCallback(() => {
    setPane('sort');
  }, [setPane]);

  const handlePressEdit = useCallback(() => {
    setPane('edit');
  }, [setPane]);

  const resetPane = useCallback(() => {
    setPane('initial');
  }, [setPane]);

  const title = utils.useGroupTitle(group) ?? 'Loading...';
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = useIsAdmin(groupId, currentUserId);
  const { data: groupUnread, isFetched: groupUnreadIsFetched } =
    store.useGroupUnread({ groupId });
  const { data: groupData } = store.useGroup({ id: groupId });
  const isWindowNarrow = useIsWindowNarrow();

  if ((!group && !groupData) || !groupUnreadIsFetched) {
    return null;
  }

  if (isWeb && !isWindowNarrow) {
    return (
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        placement="top-end"
        allowFlip
        offset={-12}
      >
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Content
          elevate
          animation="quick"
          zIndex={1000000}
          position="relative"
          borderColor="$border"
          borderWidth={1}
          padding={1}
        >
          {pane === 'notifications' ? (
            <NotificationsSheetContent
              chatTitle={title}
              onPressBack={resetPane}
            />
          ) : pane === 'edit' ? (
            <EditGroupSheetContent
              chatTitle={title}
              onPressBack={resetPane}
              onOpenChange={onOpenChange}
            />
          ) : pane === 'sort' ? (
            <SortChannelsSheetContent
              chatTitle={title}
              onPressBack={resetPane}
            />
          ) : (
            <GroupOptionsSheetContent
              currentUserIsAdmin={currentUserIsAdmin}
              groupUnread={groupUnread ?? null}
              onPressNotifications={handlePressNotifications}
              onPressSort={handlePressSort}
              onPressEditGroup={handlePressEdit}
              chatTitle={title}
              group={group || groupData!}
              onOpenChange={onOpenChange}
            />
          )}
        </Popover.Content>
      </Popover>
    );
  }

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      {pane === 'notifications' ? (
        <NotificationsSheetContent chatTitle={title} onPressBack={resetPane} />
      ) : pane === 'edit' ? (
        <EditGroupSheetContent
          chatTitle={title}
          onPressBack={resetPane}
          onOpenChange={onOpenChange}
        />
      ) : pane === 'sort' ? (
        <SortChannelsSheetContent chatTitle={title} onPressBack={resetPane} />
      ) : (
        <GroupOptionsSheetContent
          currentUserIsAdmin={currentUserIsAdmin}
          groupUnread={groupUnread ?? null}
          onPressNotifications={handlePressNotifications}
          onPressSort={handlePressSort}
          onPressEditGroup={handlePressEdit}
          chatTitle={title}
          group={group || groupData!}
          onOpenChange={onOpenChange}
        />
      )}
    </ActionSheet>
  );
}

function GroupOptionsSheetContent({
  chatTitle,
  group,
  groupUnread,
  currentUserIsAdmin,
  onPressNotifications,
  onPressSort,
  onPressEditGroup,
  onOpenChange,
}: {
  group: db.Group;
  groupUnread: db.GroupUnread | null;
  currentUserIsAdmin: boolean;
  chatTitle: string;
  onPressNotifications: () => void;
  onPressSort: () => void;
  onPressEditGroup: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    markGroupRead,
    onPressGroupMembers,
    onPressInvite,
    togglePinned,
    leaveGroup,
  } = useChatOptions();
  const groupRef = logic.getGroupReferencePath(group.id);
  const canMarkRead = !(group.unread?.count === 0 || groupUnread?.count === 0);
  const canSortChannels = (group.channels?.length ?? 0) > 1;
  const canInvite = currentUserIsAdmin || group.privacy === 'public';
  const canLeave = !group.currentUserIsHost;
  const isPinned = group?.pin;

  const wrappedAction = useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  const actionGroups = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          {
            title: 'Notifications',
            action: onPressNotifications,
            endIcon: 'ChevronRight',
          },
          canMarkRead && {
            title: 'Mark all as read',
            action: wrappedAction.bind(null, markGroupRead),
          },
          {
            title: isPinned ? 'Unpin' : 'Pin',
            endIcon: 'Pin',
            action: wrappedAction.bind(null, togglePinned),
          },
          {
            title: 'Copy group reference',
            description: groupRef,
            render: (props) => (
              <ActionSheet.CopyAction {...props} copyText={groupRef} />
            ),
          },
          canSortChannels && {
            title: 'Sort channels',
            endIcon: 'ChevronRight',
            action: wrappedAction.bind(null, onPressSort),
          },
        ],
        [
          'neutral',
          currentUserIsAdmin && {
            title: 'Edit group',
            action: onPressEditGroup,
            endIcon: 'ChevronRight',
          },
          {
            title: 'Members',
            endIcon: 'ChevronRight',
            action: wrappedAction.bind(null, onPressGroupMembers),
          },
          canInvite
            ? {
                title: 'Invite people',
                action: wrappedAction.bind(null, onPressInvite),
                endIcon: 'ChevronRight',
              }
            : {
                accent: 'disabled',
                title: 'Invites disabled',
                description: 'Only admins may invite people to this group.',
              },
        ],
        canLeave && [
          'negative',
          {
            title: 'Leave group',
            endIcon: 'LogOut',
            action: wrappedAction.bind(null, leaveGroup),
          },
        ]
      ),
    [
      canInvite,
      canLeave,
      canMarkRead,
      canSortChannels,
      currentUserIsAdmin,
      groupRef,
      isPinned,
      leaveGroup,
      markGroupRead,
      onPressEditGroup,
      onPressGroupMembers,
      onPressInvite,
      onPressNotifications,
      onPressSort,
      togglePinned,
      wrappedAction,
    ]
  );

  const memberCount = group?.members?.length ? group.members.length : 0;
  const privacy = group?.privacy
    ? group.privacy.charAt(0).toUpperCase() + group.privacy.slice(1)
    : '';
  const subtitle = memberCount
    ? `${privacy} group with ${memberCount} member${group.members?.length === 1 ? '' : 's'}`
    : '';

  return (
    <ChatOptionsSheetContent
      title={chatTitle}
      subtitle={subtitle}
      actionGroups={actionGroups}
      icon={<ListItem.GroupIcon model={group} />}
    />
  );
}

function SortChannelsSheetContent({
  chatTitle,
  onPressBack,
}: {
  chatTitle: string;
  onPressBack: () => void;
}) {
  const { setChannelSortPreference } = useChatOptions();

  const sortActions = useMemo(
    () =>
      createActionGroups([
        'neutral',
        {
          title: 'Sort by recency',
          action: () => setChannelSortPreference?.('recency'),
        },
        {
          title: 'Sort by arrangement',
          action: () => setChannelSortPreference?.('arranged'),
        },
      ]),
    [setChannelSortPreference]
  );

  return (
    <ChatOptionsSheetContent
      title={'Sort channels in ' + chatTitle}
      subtitle="Choose your display preference"
      actionGroups={sortActions}
      icon={<SheetBackButton onPress={onPressBack} />}
    />
  );
}

function EditGroupSheetContent({
  chatTitle,
  onPressBack,
  onOpenChange,
}: {
  chatTitle: string;
  onPressBack: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const { onPressGroupMeta, onPressManageChannels, onPressGroupPrivacy } =
    useChatOptions();

  const wrappedAction = useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  const editActions = useMemo(
    () =>
      createActionGroups([
        'neutral',
        {
          title: 'Edit group info',
          description: 'Change name, description, and image',
          action: wrappedAction.bind(null, onPressGroupMeta),
          endIcon: 'ChevronRight',
        },
        {
          title: 'Manage channels',
          description: 'Add or remove channels in this group',
          action: wrappedAction.bind(null, onPressManageChannels),
          endIcon: 'ChevronRight',
        },
        {
          title: 'Privacy',
          description: 'Change who can find or join this group',
          action: wrappedAction.bind(null, onPressGroupPrivacy),
          endIcon: 'ChevronRight',
        },
        !isWindowNarrow && {
          title: 'Back',
          action: onPressBack,
          startIcon: 'ChevronLeft',
        },
      ]),
    [
      onPressGroupMeta,
      onPressGroupPrivacy,
      onPressManageChannels,
      onPressBack,
      isWindowNarrow,
      wrappedAction,
    ]
  );

  return (
    <ChatOptionsSheetContent
      title={'Edit ' + chatTitle}
      subtitle="Edit group details"
      actionGroups={editActions}
      icon={<SheetBackButton onPress={onPressBack} />}
    />
  );
}

type ChannelPanes = 'initial' | 'notifications';

export function ChannelOptionsSheetLoader({
  channelId,
  open,
  onOpenChange,
  trigger,
}: {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [pane, setPane] = useState<ChannelPanes>('initial');
  const channelQuery = store.useChannel({
    id: channelId,
  });
  const { data: group } = store.useGroup({
    id: channelQuery.data?.groupId ?? undefined,
  });
  const groupTitle = utils.useGroupTitle(group) ?? 'group';
  const channelTitle =
    utils.useChannelTitle(channelQuery.data ?? null) ?? 'channel';
  const isSingleChannelGroup = group?.channels.length === 1;
  const chatTitle = isSingleChannelGroup ? groupTitle : channelTitle;
  const isWindowNarrow = useIsWindowNarrow();

  const handlePressNotifications = useCallback(() => {
    setPane('notifications');
  }, [setPane]);

  const resetPane = useCallback(() => {
    setPane('initial');
  }, [setPane]);

  useEffect(() => {
    if (!open) {
      resetPane();
    }
  }, [open, resetPane]);

  if (!channelQuery.data) {
    return null;
  }

  if (isWeb && !isWindowNarrow) {
    return (
      <Popover
        open={open}
        onOpenChange={onOpenChange}
        placement="top-end"
        allowFlip
        offset={-12}
      >
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Content
          elevate
          animation="quick"
          zIndex={1000000}
          position="relative"
          borderColor="$border"
          borderWidth={1}
          padding={1}
        >
          {pane === 'notifications' ? (
            <NotificationsSheetContent
              chatTitle={chatTitle}
              onPressBack={resetPane}
            />
          ) : (
            <ChannelOptionsSheetContent
              chatTitle={chatTitle}
              channel={channelQuery.data}
              onPressNotifications={handlePressNotifications}
              onOpenChange={onOpenChange}
            />
          )}
        </Popover.Content>
      </Popover>
    );
  }

  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      {pane === 'notifications' ? (
        <NotificationsSheetContent
          chatTitle={chatTitle}
          onPressBack={resetPane}
        />
      ) : (
        <ChannelOptionsSheetContent
          chatTitle={chatTitle}
          channel={channelQuery.data}
          onPressNotifications={handlePressNotifications}
          onOpenChange={onOpenChange}
        />
      )}
    </ActionSheet>
  );
}

function ChannelOptionsSheetContent({
  chatTitle,
  channel,
  onPressNotifications,
  onOpenChange,
}: {
  chatTitle: string;
  channel: db.Channel;
  onPressNotifications: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    group,
    onPressChannelMembers,
    onPressChannelMeta,
    onPressChannelTemplate,
    onPressManageChannels,
    onPressInvite,
    togglePinned,
    leaveChannel,
    markChannelRead,
  } = useChatOptions();
  const { data: hooksPreview } = store.useChannelHooksPreview(channel.id);

  const currentUser = useCurrentUserId();
  const currentUserIsHost = group?.currentUserIsHost ?? false;
  const currentUserIsAdmin = useIsAdmin(channel.groupId ?? '', currentUser);
  const groupTitle = utils.useGroupTitle(group) ?? 'group';
  const isSingleChannelGroup = group?.channels?.length === 1;
  const invitationsEnabled =
    group?.privacy === 'private' || group?.privacy === 'secret';
  const canInvite = invitationsEnabled && currentUserIsAdmin;
  const canMarkRead = !(channel.unread?.count === 0);

  const wrappedAction = useCallback(
    (action: () => void) => {
      action();
      onOpenChange(false);
    },
    [onOpenChange]
  );

  const actionGroups: ActionGroup[] = useMemo(
    () =>
      createActionGroups(
        [
          'neutral',
          {
            title: 'Notifications',
            endIcon: 'ChevronRight',
            action: onPressNotifications,
          },
          {
            title: channel?.pin ? 'Unpin' : 'Pin',
            endIcon: 'Pin',
            action: wrappedAction.bind(null, togglePinned),
          },
          canMarkRead && {
            title: 'Mark as read',
            action: wrappedAction.bind(null, markChannelRead),
          },
        ],
        channel.type === 'groupDm' && [
          'neutral',
          {
            title: 'Edit group info',
            endIcon: 'ChevronRight',
            action: wrappedAction.bind(null, onPressChannelMeta),
          },
          {
            title: 'Members',
            endIcon: 'ChevronRight',
            action: wrappedAction.bind(null, onPressChannelMembers),
          },
        ],
        group && [
          'neutral',
          currentUserIsAdmin && {
            title: 'Manage channels',
            endIcon: 'ChevronRight',
            action: wrappedAction.bind(null, onPressManageChannels),
          },
          canInvite
            ? {
                title: 'Invite people',
                action: wrappedAction.bind(null, onPressInvite),
                endIcon: 'ChevronRight',
              }
            : {
                title: 'Invites disabled',
                accent: 'disabled',
                description: 'Only admins may invite people to this group.',
              },
        ],
        hooksPreview && [
          'neutral',
          {
            title: 'Use channel as template',
            description: 'Create a new channel based on this one',
            endIcon: 'Copy',
            action: wrappedAction.bind(null, onPressChannelTemplate),
          },
        ],
        !currentUserIsHost && [
          'negative',
          {
            title: `Leave`,
            endIcon: 'LogOut',
            action: wrappedAction.bind(null, leaveChannel),
          },
        ]
      ),
    [
      onPressNotifications,
      channel?.pin,
      channel.type,
      togglePinned,
      canMarkRead,
      markChannelRead,
      onPressChannelMeta,
      onPressChannelMembers,
      group,
      currentUserIsAdmin,
      onPressManageChannels,
      onPressChannelTemplate,
      canInvite,
      onPressInvite,
      currentUserIsHost,
      leaveChannel,
      wrappedAction,
      hooksPreview,
    ]
  );

  const subtitle = useMemo(() => {
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
          ? isSingleChannelGroup
            ? `Group with ${group.members?.length ?? 0} members`
            : `Channel in ${groupTitle}`
          : '';
    }
  }, [channel, group, groupTitle, isSingleChannelGroup]);

  return (
    <ChatOptionsSheetContent
      title={chatTitle ?? ''}
      subtitle={subtitle}
      actionGroups={actionGroups}
      icon={<ListItem.ChannelIcon model={channel} />}
    />
  );
}

function ChatOptionsSheetContent({
  actionGroups,
  title,
  subtitle,
  icon,
}: {
  actionGroups: ActionGroup[];
  title: string;
  subtitle: string;
  icon?: ReactElement;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  return (
    <>
      {isWindowNarrow && (
        <ActionSheet.Header>
          {icon}
          <ActionSheet.MainContent>
            <ListItem.Title>{title}</ListItem.Title>
            <ListItem.Subtitle $gtSm={{ maxWidth: '100%' }}>
              {subtitle}
            </ListItem.Subtitle>
          </ActionSheet.MainContent>
        </ActionSheet.Header>
      )}
      <ActionSheet.ScrollableContent width={isWindowNarrow ? '100%' : 240}>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.ScrollableContent>
    </>
  );
}

const notificationOptions: { title: string; value: ub.NotificationLevel }[] = [
  {
    title: 'All activity',
    value: 'loud',
  },
  {
    title: 'Posts, mentions, and replies',
    value: 'medium',
  },
  {
    title: 'Only mentions and replies',
    value: 'soft',
  },
  {
    title: 'Nothing',
    value: 'hush',
  },
];

function NotificationsSheetContent({
  chatTitle,
  onPressBack,
}: {
  chatTitle?: string | null;
  onPressBack: () => void;
}) {
  const isWindowNarrow = useIsWindowNarrow();
  const { updateVolume, group, channel } = useChatOptions();
  const { data: currentChannelVolume } = store.useChannelVolumeLevel(
    channel?.id ?? ''
  );
  const { data: currentGroupVolume } = store.useGroupVolumeLevel(
    group?.id ?? ''
  );
  const currentVolumeLevel = channel?.id
    ? currentChannelVolume
    : currentGroupVolume;

  const notificationActions = useMemo(
    () =>
      createActionGroups([
        'neutral',
        ...notificationOptions.map(
          ({ title, value }): Action => ({
            title,
            accent: currentVolumeLevel === value ? 'positive' : 'neutral',
            action: () => updateVolume(value),
            endIcon: currentVolumeLevel === value ? 'Checkmark' : undefined,
          })
        ),
        !isWindowNarrow && {
          title: 'Back',
          action: onPressBack,
          startIcon: 'ChevronLeft',
        },
      ]),
    [currentVolumeLevel, updateVolume, isWindowNarrow, onPressBack]
  );
  return (
    <ChatOptionsSheetContent
      title={chatTitle ? 'Notifications for ' + chatTitle : 'Notifications'}
      actionGroups={notificationActions}
      subtitle={'Set what you want to be notified about'}
      icon={<SheetBackButton onPress={onPressBack} />}
    />
  );
}

function SheetBackButton({ onPress }: { onPress: () => void }) {
  return (
    <IconButton width="$4xl" onPress={onPress}>
      <ChevronLeft />
    </IconButton>
  );
}
