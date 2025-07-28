import { featureFlags } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import { Icon, useIsWindowNarrow } from '@tloncorp/ui';
import { IconButton } from '@tloncorp/ui';
import { isEqual } from 'lodash';
import React, {
  ReactElement,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { Popover, isWeb } from 'tamagui';

import { useCurrentUserId } from '../contexts';
import { useChatOptions } from '../contexts/chatOptions';
import * as utils from '../utils';
import {
  Action,
  ActionGroup,
  ActionSheet,
  createActionGroups,
} from './ActionSheet';
import { ListItem } from './ListItem';

type ChatOptionsSheetProps = {
  // Make open/onOpenChange optional since we can use context
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPressConfigureChannel?: () => void;
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
  const { open: contextOpen, setChat, group } = useChatOptions();

  // Use props for explicit control (popovers)
  // For sheets, this will be false and context.open will handle state
  const isOpen = propOpen ?? false;

  // Handle open state changes
  const handleOpenChange = useCallback(
    (open: boolean, clearChat = true) => {
      if (open && chat) {
        // Set chat state for both popovers and sheets
        contextOpen(chat.id, chat.type);
      } else if (!open) {
        // Close both popover and sheet states
        if (propOnOpenChange) {
          propOnOpenChange(false);
        }
        // Clear chat state after a short delay to allow handlers to complete
        if (clearChat) {
          setTimeout(() => {
            setChat(null);
          }, 100);
        }
      }

      // Call provided handler for popovers
      if (propOnOpenChange) {
        propOnOpenChange(open);
      }
    },
    [chat, contextOpen, setChat, propOnOpenChange]
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
}, isEqual);

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

  const resetPane = useCallback(() => {
    setPane('initial');
  }, [setPane]);

  useEffect(() => {
    if (!open) {
      resetPane();
    }
  }, [open, resetPane]);

  const title = utils.useGroupTitle(group) ?? 'Loading...';
  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = utils.useIsAdmin(groupId, currentUserId);
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
        <Popover.Trigger
          asChild
          data-testid="GroupOptionsSheetTrigger"
          role="button"
        >
          {trigger}
        </Popover.Trigger>
        <Popover.Content
          elevate
          zIndex={1000000}
          position="relative"
          borderColor="$border"
          borderWidth={1}
          padding={1}
          backgroundColor="$background"
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
              groupUnread={groupUnread ?? null}
              currentUserIsAdmin={currentUserIsAdmin}
              onPressNotifications={handlePressNotifications}
              onPressSort={handlePressSort}
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
          groupUnread={groupUnread ?? null}
          currentUserIsAdmin={currentUserIsAdmin}
          onPressNotifications={handlePressNotifications}
          onPressSort={handlePressSort}
          chatTitle={title}
          group={group || groupData!}
          onOpenChange={onOpenChange}
        />
      )}
    </ActionSheet>
  );
}

export function GroupOptionsSheetContent({
  chatTitle,
  group,
  groupUnread,
  currentUserIsAdmin,
  onPressNotifications,
  onPressSort,
  onOpenChange,
}: {
  group: db.Group;
  groupUnread: db.GroupUnread | null;
  chatTitle: string;
  currentUserIsAdmin: boolean;
  onPressNotifications: () => void;
  onPressSort: () => void;
  onOpenChange: (open: boolean, clearChat?: boolean) => void;
}) {
  const { markGroupRead, onPressChatDetails, togglePinned, onPressInvite } =
    useChatOptions();
  const canMarkRead = !(group.unread?.count === 0 || groupUnread?.count === 0);
  const canSortChannels = (group.channels?.length ?? 0) > 1;
  const canInvite = currentUserIsAdmin || group.privacy === 'public';
  const isPinned = group?.pin;
  const isErrored = group?.joinStatus === 'errored';

  const wrappedAction = useCallback(
    (action: () => void, clearChat = true) => {
      action();
      onOpenChange(false, clearChat);
    },
    [onOpenChange]
  );

  const handlePressChatDetails = useCallback(() => {
    onPressChatDetails({ type: 'group', id: group.id });
  }, [group.id, onPressChatDetails]);

  const handleCancel = useCallback(async () => {
    await store.cancelGroupJoin(group);
    store.leaveGroup(group.id);
  }, [group]);

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
          canSortChannels && {
            title: 'Sort channels',
            endIcon: 'ChevronRight',
            action: onPressSort,
          },
        ],
        [
          'neutral',
          canInvite
            ? {
                title: 'Invite people',
                action: wrappedAction.bind(null, onPressInvite, false),
                endIcon: 'ChevronRight',
              }
            : {
                accent: 'disabled',
                title: 'Invites disabled',
                description: 'Only admins may invite people to this group.',
              },
          {
            title: 'Group info & settings',
            action: wrappedAction.bind(null, handlePressChatDetails),
            endIcon: 'ChevronRight',
          },
        ],
        // this is CYA in case the group somehow looks joined but isn't
        isErrored && [
          'negative',
          {
            title: 'Cancel join',
            description: 'Group joining failed or timed out',
            action: wrappedAction.bind(null, handleCancel),
          },
        ]
      ),
    [
      canInvite,
      canMarkRead,
      canSortChannels,
      handlePressChatDetails,
      isPinned,
      markGroupRead,
      onPressInvite,
      onPressNotifications,
      onPressSort,
      togglePinned,
      wrappedAction,
      handleCancel,
      isErrored,
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

const ChannelOptionsSheetLoader = memo(
  ({
    channelId,
    open,
    onOpenChange,
    trigger,
    onPressConfigureChannel,
  }: {
    channelId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    trigger?: React.ReactNode;
    onPressConfigureChannel?: () => void;
  }) => {
    const [pane, setPane] = useState<ChannelPanes>('initial');
    const channelQuery = store.useChannel({
      id: channelId,
    });
    const groupId = useMemo(
      () => channelQuery.data?.groupId ?? undefined,
      [channelQuery.data?.groupId]
    );

    const { data: group } = store.useGroup({
      id: groupId,
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

    // Define channel variable before it's used in conditionals
    const channel = channelQuery.data!;

    if (isWeb && !isWindowNarrow) {
      return (
        <Popover
          open={open}
          onOpenChange={onOpenChange}
          placement="top-end"
          allowFlip
          offset={-12}
        >
          <Popover.Trigger
            asChild
            data-testid="ChannelOptionsSheetTrigger"
            role="button"
          >
            {trigger}
          </Popover.Trigger>
          <Popover.Content
            elevate
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
                channel={channel}
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
            channel={channel}
            onPressNotifications={handlePressNotifications}
            onOpenChange={onOpenChange}
            onPressConfigureChannel={onPressConfigureChannel}
          />
        )}
      </ActionSheet>
    );
  }
);
ChannelOptionsSheetLoader.displayName = 'ChannelOptionsSheetLoader';

export function ChannelOptionsSheetContent({
  chatTitle,
  channel,
  onPressConfigureChannel,
  onPressNotifications,
  onOpenChange,
}: {
  chatTitle: string;
  channel: db.Channel;
  onPressConfigureChannel?: () => void;
  onPressNotifications: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    group,
    onPressChatDetails,
    onPressChannelMembers,
    onPressChannelMeta,
    onPressChannelTemplate,
    togglePinned,
    leaveChannel,
    markChannelRead,
  } = useChatOptions();
  const { data: hooksPreview } = store.useChannelHooksPreview(channel.id);

  const currentUserId = useCurrentUserId();
  const currentUserIsAdmin = utils.useIsAdmin(
    channel.groupId ?? '',
    currentUserId
  );
  const currentUserIsChannelHost = channel.currentUserIsHost ?? false;

  const groupTitle = utils.useGroupTitle(group) ?? 'group';
  const isSingleChannelGroup = group?.channels?.length === 1;
  const canMarkRead = !(channel.unread?.count === 0);
  const enableCustomChannels = useCustomChannelsEnabled();

  const handlePressChatDetails = useCallback(() => {
    if (!group) {
      throw new Error("Channel doesn't have a group");
    }
    onPressChatDetails({ type: 'group', id: group.id });
  }, [group, onPressChatDetails]);

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
            action: wrappedAction.bind(null, () =>
              markChannelRead({ includeThreads: true })
            ),
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
          {
            title: 'Group info & settings',
            action: wrappedAction.bind(null, handlePressChatDetails),
            endIcon: 'ChevronRight',
          },
          currentUserIsAdmin &&
            enableCustomChannels && {
              title: 'Configure view',
              action: onPressConfigureChannel,
              endIcon: 'ChevronRight',
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
        currentUserIsChannelHost && [
          'negative',
          {
            title: 'Cannot leave channel',
            description: 'Host (you) must delete to leave',
            disabled: true,
          },
        ],
        !currentUserIsChannelHost && [
          'negative',
          {
            title: group ? `Leave channel` : 'Leave chat',
            endIcon: 'LogOut',
            action: wrappedAction.bind(null, leaveChannel),
          },
        ]
      ),
    [
      onPressNotifications,
      channel?.pin,
      channel.type,
      wrappedAction,
      togglePinned,
      canMarkRead,
      markChannelRead,
      onPressChannelMeta,
      onPressChannelMembers,
      group,
      handlePressChatDetails,
      currentUserIsAdmin,
      enableCustomChannels,
      onPressConfigureChannel,
      hooksPreview,
      onPressChannelTemplate,
      currentUserIsChannelHost,
      leaveChannel,
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

export function ChatOptionsSheetContent({
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

export const notificationOptions: {
  title: string;
  value: ub.NotificationLevel;
}[] = [
  {
    title: 'All activity',
    value: 'loud',
  },
  {
    title: 'Posts, mentions, and replies',
    value: 'medium',
  },
  {
    title: 'Mentions and replies',
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
      <Icon type="ChevronLeft" />
    </IconButton>
  );
}

function useCustomChannelsEnabled() {
  const [enableCustomChannels, setEnableCustomChannels] = useState(false);
  // why useLayoutEffect?
  // to try to get the synchronous read to avoid flicker on mount
  useLayoutEffect(() => {
    return featureFlags.subscribeToFeatureFlag(
      'customChannelCreation',
      (flag) => {
        setEnableCustomChannels(flag);
      }
    );
  }, []);

  return enableCustomChannels;
}
