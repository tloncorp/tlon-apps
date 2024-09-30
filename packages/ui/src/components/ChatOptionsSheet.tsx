import { sync } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import * as ub from '@tloncorp/shared/dist/urbit';
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useSheet } from 'tamagui';

import { ChevronLeft } from '../assets/icons';
import { useCalm, useChatOptions, useCurrentUserId } from '../contexts';
import * as utils from '../utils';
import { Action, ActionGroup, ActionSheet } from './ActionSheet';
import { IconButton } from './IconButton';
import { ListItem } from './ListItem';

export type ChatType = 'group' | db.ChannelType;

export type ChatOptionsSheetMethods = {
  open: (chatId: string, chatType: ChatType) => void;
};

export type ChatOptionsSheetRef = React.Ref<ChatOptionsSheetMethods>;

const ChatOptionsSheetComponent = React.forwardRef<ChatOptionsSheetMethods>(
  function ChatOptionsSheetImpl(props, ref) {
    const [open, setOpen] = useState(false);
    const [chat, setChat] = useState<{ type: ChatType; id: string } | null>(
      null
    );

    useImperativeHandle(
      ref,
      () => ({
        open: (chatId, chatType) => {
          setOpen(true);
          setChat({ id: chatId, type: chatType });
        },
      }),
      []
    );

    if (!chat || !open) {
      return null;
    }

    if (chat.type === 'group') {
      return (
        <GroupOptionsSheetLoader
          groupId={chat.id}
          open={open}
          onOpenChange={setOpen}
        />
      );
    }

    return (
      <ChannelOptionsSheetLoader
        channelId={chat.id}
        open={open}
        onOpenChange={setOpen}
      />
    );
  }
);

export const ChatOptionsSheet = React.memo(ChatOptionsSheetComponent);

export function GroupOptionsSheetLoader({
  groupId,
  open,
  onOpenChange,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const groupQuery = store.useGroup({ id: groupId });
  const [pane, setPane] = useState<'initial' | 'notifications'>('initial');
  const openChangeHandler = useCallback(
    (open: boolean) => {
      if (!open) {
        setPane('initial');
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return groupQuery.data ? (
    <ActionSheet open={open} onOpenChange={openChangeHandler}>
      <GroupOptions group={groupQuery.data} pane={pane} setPane={setPane} />
    </ActionSheet>
  ) : null;
}

export function GroupOptions({
  group,
  pane,
  setPane,
}: {
  group: db.Group;
  pane: 'initial' | 'notifications';
  setPane: (pane: 'initial' | 'notifications') => void;
}) {
  const currentUser = useCurrentUserId();
  const { data: currentVolumeLevel } = store.useGroupVolumeLevel(group.id);
  const sheet = useSheet();
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const {
    onPressGroupMembers,
    onPressGroupMeta,
    onPressManageChannels,
    onPressInvite,
    onPressGroupPrivacy,
    onPressLeave,
    onTogglePinned,
  } = useChatOptions() ?? {};

  useEffect(() => {
    sync.syncGroup(group.id, { priority: store.SyncPriority.High });
  }, [group]);

  const isPinned = group?.pin;

  const currentUserIsAdmin = useMemo(
    () =>
      group?.members?.some(
        (m) =>
          m.contactId === currentUser &&
          m.roles?.some((r) => r.roleId === 'admin')
      ) ?? false,
    [currentUser, group?.members]
  );

  const handleVolumeUpdate = useCallback(
    (newLevel: string) => {
      if (group) {
        store.setGroupVolumeLevel({
          group: group,
          level: newLevel as ub.NotificationLevel,
        });
      }
    },
    [group]
  );

  const actionNotifications: ActionGroup[] = useMemo(
    () => [
      {
        accent: 'neutral',
        actions: [
          {
            title: 'All activity',
            accent: currentVolumeLevel === 'loud' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('loud');
            },
            endIcon: currentVolumeLevel === 'loud' ? 'Checkmark' : undefined,
          },
          {
            title: 'Posts, mentions, and replies',
            accent: currentVolumeLevel === 'medium' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('medium');
            },
            endIcon: currentVolumeLevel === 'medium' ? 'Checkmark' : undefined,
          },
          {
            title: 'Only mentions and replies',
            accent: currentVolumeLevel === 'soft' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('soft');
            },
            endIcon: currentVolumeLevel === 'soft' ? 'Checkmark' : undefined,
          },
          {
            title: 'Nothing',
            accent: currentVolumeLevel === 'hush' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('hush');
            },
            endIcon: currentVolumeLevel === 'hush' ? 'Checkmark' : undefined,
          },
        ],
      },
    ],
    [currentVolumeLevel, handleVolumeUpdate]
  );

  const actionGroups = useMemo(() => {
    const groupRef = logic.getGroupReferencePath(group.id);

    const actionGroups: ActionGroup[] = [
      {
        accent: 'neutral',
        actions: [
          {
            title: 'Notifications',
            action: () => {
              setPane('notifications');
            },
            endIcon: 'ChevronRight',
          },
          {
            title: isPinned ? 'Unpin' : 'Pin',
            endIcon: 'Pin',
            action: onTogglePinned,
          },
          {
            title: 'Copy group reference',
            description: groupRef,
            render: (props) => (
              <ActionSheet.CopyAction {...props} copyText={groupRef} />
            ),
          },
        ],
      },
    ];

    const manageChannelsAction: Action = {
      title: 'Manage channels',
      action: () => {
        sheetRef.current.setOpen(false);
        onPressManageChannels?.(group.id);
      },
      endIcon: 'ChevronRight',
    };

    const managePrivacyAction: Action = {
      title: 'Privacy',
      action: () => {
        sheetRef.current.setOpen(false);
        onPressGroupPrivacy?.(group.id);
      },
      endIcon: 'ChevronRight',
    };

    const goToMembersAction: Action = {
      title: 'Members',
      endIcon: 'ChevronRight',
      action: () => {
        onPressGroupMembers?.(group.id);
        sheetRef.current.setOpen(false);
      },
    };

    const metadataAction: Action = {
      title: 'Edit group info',
      action: () => {
        sheetRef.current.setOpen(false);
        onPressGroupMeta?.(group.id);
      },
      endIcon: 'ChevronRight',
    };

    const inviteAction: Action = {
      title: 'Invite people',
      action: () => {
        sheetRef.current.setOpen(false);
        onPressInvite?.(group);
      },
      endIcon: 'ChevronRight',
    };

    const inviteNotice: Action = {
      accent: 'disabled',
      title: 'Invites disabled',
      description: 'Only admins may invite people to this group.',
    };

    if (currentUserIsAdmin) {
      actionGroups.push({
        accent: 'neutral',
        actions: [manageChannelsAction, managePrivacyAction, metadataAction],
      });
    }

    if (currentUserIsAdmin) {
      actionGroups.push({
        accent: 'neutral',
        actions: [goToMembersAction, inviteAction],
      });
    } else {
      actionGroups.push({
        accent: 'neutral',
        actions:
          group.privacy === 'public'
            ? [goToMembersAction, inviteAction]
            : [goToMembersAction, inviteNotice],
      });
    }

    if (!group.currentUserIsHost) {
      actionGroups.push({
        accent: 'negative',
        actions: [
          {
            title: 'Leave group',
            endIcon: 'LogOut',
            action: () => {
              sheetRef.current.setOpen(false);
              onPressLeave?.();
            },
          },
        ],
      });
    }
    return actionGroups;
  }, [
    isPinned,
    onTogglePinned,
    group,
    currentUserIsAdmin,
    setPane,
    onPressManageChannels,
    onPressGroupMembers,
    onPressGroupMeta,
    onPressLeave,
    onPressInvite,
    onPressGroupPrivacy,
  ]);

  const memberCount = group?.members?.length ?? 0;
  const title = group?.title ?? 'Loading…';
  const subtitle = memberCount ? `Group with ${memberCount} members` : '';
  return (
    <ChatOptionsSheetContent
      actionGroups={pane === 'initial' ? actionGroups : actionNotifications}
      title={pane === 'initial' ? title : 'Notifications for ' + title}
      subtitle={
        pane === 'initial' ? subtitle : 'Set what you want to be notified about'
      }
      icon={
        pane === 'initial' ? (
          <ListItem.GroupIcon model={group} />
        ) : (
          <IconButton width="$4xl" onPress={() => setPane('initial')}>
            <ChevronLeft />
          </IconButton>
        )
      }
    />
  );
}

export function ChannelOptionsSheetLoader({
  channelId,
  open,
  onOpenChange,
}: {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pane, setPane] = useState<'initial' | 'notifications'>('initial');
  const channelQuery = store.useChannelWithRelations({
    id: channelId,
  });

  const openChangeHandler = useCallback(
    (open: boolean) => {
      if (!open) {
        setPane('initial');
      }
      onOpenChange(open);
    },
    [onOpenChange]
  );

  return channelQuery.data ? (
    <ActionSheet open={open} onOpenChange={openChangeHandler}>
      <ChannelOptions
        channel={channelQuery.data}
        pane={pane}
        setPane={setPane}
      />
    </ActionSheet>
  ) : null;
}

export function ChannelOptions({
  channel,
  pane,
  setPane,
}: {
  channel: db.Channel;
  pane: 'initial' | 'notifications';
  setPane: (pane: 'initial' | 'notifications') => void;
}) {
  const { data: group } = store.useGroup({
    id: channel?.groupId ?? undefined,
  });
  const { data: currentVolumeLevel } = store.useChannelVolumeLevel(channel.id);
  const currentUser = useCurrentUserId();
  const sheet = useSheet();
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const { onPressChannelMembers, onPressChannelMeta, onPressManageChannels } =
    useChatOptions() ?? {};

  const currentUserIsHost = useMemo(
    () => group?.currentUserIsHost ?? false,
    [group?.currentUserIsHost]
  );

  const currentUserIsAdmin = useMemo(
    () =>
      group?.members?.some(
        (m) =>
          m.contactId === currentUser &&
          m.roles?.some((r) => r.roleId === 'admin')
      ) ?? false,
    [currentUser, group?.members]
  );

  const { disableNicknames } = useCalm();
  const title = useMemo(() => {
    return channel
      ? utils.getChannelTitle(channel, disableNicknames)
      : 'Loading...';
  }, [channel, disableNicknames]);

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
        return group ? `Channel in ${group?.title}` : '';
    }
  }, [channel, group]);

  const handleVolumeUpdate = useCallback(
    (newLevel: string) => {
      if (channel) {
        store.setChannelVolumeLevel({
          channel: channel,
          level: newLevel as ub.NotificationLevel,
        });
      }
    },
    [channel]
  );

  const actionNotifications: ActionGroup[] = useMemo(
    () => [
      {
        accent: 'neutral',
        actions: [
          {
            title: 'All activity',
            accent: currentVolumeLevel === 'loud' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('loud');
            },
            endIcon: currentVolumeLevel === 'loud' ? 'Checkmark' : undefined,
          },
          {
            title: 'Posts, mentions, and replies',
            accent: currentVolumeLevel === 'medium' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('medium');
            },
            endIcon: currentVolumeLevel === 'medium' ? 'Checkmark' : undefined,
          },
          {
            title: 'Only mentions and replies',
            accent: currentVolumeLevel === 'soft' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('soft');
            },
            endIcon: currentVolumeLevel === 'soft' ? 'Checkmark' : undefined,
          },
          {
            title: 'Nothing',
            accent: currentVolumeLevel === 'hush' ? 'positive' : 'neutral',
            action: () => {
              handleVolumeUpdate('hush');
            },
            endIcon: currentVolumeLevel === 'hush' ? 'Checkmark' : undefined,
          },
        ],
      },
    ],
    [currentVolumeLevel, handleVolumeUpdate]
  );

  const actionGroups: ActionGroup[] = useMemo(() => {
    return [
      {
        accent: 'neutral',
        actions: [
          {
            title: 'Notifications',
            endIcon: 'ChevronRight',
            action: () => {
              if (!channel) {
                return;
              }
              setPane('notifications');
            },
            icon: 'ChevronRight',
          },
          {
            title: channel?.pin ? 'Unpin' : 'Pin',
            endIcon: 'Pin',
            action: () => {
              if (!channel) {
                return;
              }
              channel.pin
                ? store.unpinItem(channel.pin)
                : store.pinItem(channel);
            },
          },
        ],
      },
      ...(channel.type === 'groupDm'
        ? [
            {
              accent: 'neutral',
              actions: [
                {
                  title: 'Edit group info',
                  endIcon: 'ChevronRight',
                  action: () => {
                    if (!channel) {
                      return;
                    }
                    onPressChannelMeta?.(channel.id);
                    sheetRef.current.setOpen(false);
                  },
                },
              ],
            } as ActionGroup,
          ]
        : []),
      ...(channel.type === 'groupDm'
        ? [
            {
              accent: 'neutral',
              actions: [
                {
                  title: 'Members',
                  endIcon: 'ChevronRight',
                  action: () => {
                    if (!channel) {
                      return;
                    }
                    onPressChannelMembers?.(channel.id);
                    sheetRef.current.setOpen(false);
                  },
                },
              ],
            } as ActionGroup,
          ]
        : []),
      ...(currentUserIsAdmin
        ? [
            {
              accent: 'neutral',
              actions: [
                {
                  title: 'Manage channels',
                  endIcon: 'ChevronRight',
                  action: () => {
                    if (!group) {
                      return;
                    }
                    onPressManageChannels?.(group.id);
                    sheetRef.current.setOpen(false);
                  },
                },
              ],
            } as ActionGroup,
          ]
        : []),
      ...(!currentUserIsHost
        ? [
            {
              accent: 'negative',
              actions: [
                {
                  title: `Leave`,
                  endIcon: 'LogOut',
                  action: () => {
                    if (!channel) {
                      return;
                    }
                    Alert.alert(
                      `Leave ${title}?`,
                      'This will be removed from the list',
                      [
                        {
                          text: 'Cancel',
                          onPress: () => console.log('Cancel Pressed'),
                          style: 'cancel',
                        },
                        {
                          text: 'Leave',
                          style: 'destructive',
                          onPress: () => {
                            sheetRef.current.setOpen(false);
                            store.respondToDMInvite({ channel, accept: false });
                          },
                        },
                      ]
                    );
                  },
                },
              ],
            } as ActionGroup,
          ]
        : []),
    ];
  }, [
    channel,
    onPressChannelMembers,
    onPressChannelMeta,
    setPane,
    title,
    currentUserIsAdmin,
    currentUserIsHost,
    group,
    onPressManageChannels,
  ]);
  return (
    <ChatOptionsSheetContent
      actionGroups={pane === 'initial' ? actionGroups : actionNotifications}
      title={pane === 'initial' ? title : 'Notifications for ' + title}
      subtitle={
        pane === 'initial' ? subtitle : 'Set what you want to be notified about'
      }
      icon={
        pane === 'initial' ? (
          <ListItem.ChannelIcon model={channel} />
        ) : (
          <IconButton width="$4xl" onPress={() => setPane('initial')}>
            <ChevronLeft />
          </IconButton>
        )
      }
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
  return (
    <>
      <ActionSheet.Header>
        {icon}
        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
      </ActionSheet.Header>
      <ActionSheet.ScrollableContent>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.ScrollableContent>
    </>
  );
}
