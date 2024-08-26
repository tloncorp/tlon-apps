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

import { useCalm, useChatOptions, useCurrentUserId } from '../contexts';
import * as utils from '../utils';
import { Action, ActionGroup, ActionSheet } from './ActionSheet';
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

    if (!chat && !open) {
      return null;
    }

    return (
      <ActionSheet open={open} onOpenChange={setOpen}>
        {chat ? (
          chat.type === 'group' ? (
            <GroupOptionsSheetLoader
              groupId={chat.id}
              open={open}
              onOpenChange={setOpen}
            />
          ) : (
            <ChannelOptionsSheetLoader
              channelId={chat.id}
              open={open}
              onOpenChange={setOpen}
            />
          )
        ) : null}
      </ActionSheet>
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
    onPressInvitesAndPrivacy,
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
            action: () => {
              handleVolumeUpdate('loud');
            },
            icon: currentVolumeLevel === 'loud' ? 'Checkmark' : undefined,
          },
          {
            title: 'Posts, mentions, and replies',
            action: () => {
              handleVolumeUpdate('medium');
            },
            icon: currentVolumeLevel === 'medium' ? 'Checkmark' : undefined,
          },
          {
            title: 'Only mentions and replies',
            action: () => {
              handleVolumeUpdate('soft');
            },
            icon: currentVolumeLevel === 'soft' ? 'Checkmark' : undefined,
          },
          {
            title: 'Nothing',
            action: () => {
              handleVolumeUpdate('hush');
            },
            icon: currentVolumeLevel === 'hush' ? 'Checkmark' : undefined,
          },
          {
            title: 'Back',
            action: () => {
              setPane('initial');
            },
          },
        ],
      },
    ],
    [currentVolumeLevel, handleVolumeUpdate, setPane]
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
        onPressInvitesAndPrivacy?.(group.id);
      },
      endIcon: 'ChevronRight',
    };

    const goToMembersAction: Action = {
      title: 'Members',
      endIcon: 'ChevronRight',
      action: () => {
        if (!group) {
          return;
        }
        onPressGroupMembers?.(group.id);
        sheetRef.current.setOpen(false);
      },
    };

    const metadataAction: Action = {
      title: 'Edit metadata',
      action: () => {
        sheetRef.current.setOpen(false);
        onPressGroupMeta?.(group.id);
      },
      endIcon: 'ChevronRight',
    };

    actionGroups.push({
      accent: 'neutral',
      actions:
        group && currentUserIsAdmin
          ? [
              manageChannelsAction,
              managePrivacyAction,
              goToMembersAction,
              metadataAction,
            ]
          : [goToMembersAction],
    });

    if (group && !group.currentUserIsHost) {
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
  ]);

  const memberCount = group?.members?.length ?? 0;
  const title = group?.title ?? 'Loading…';
  const subtitle = memberCount ? `Group with ${memberCount} members` : '';
  return (
    <ChatOptionsSheetContent
      actionGroups={pane === 'initial' ? actionGroups : actionNotifications}
      title={title}
      subtitle={subtitle}
      icon={<ListItem.GroupIcon model={group} />}
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
  const sheet = useSheet();
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const { onPressChannelMembers, onPressChannelMeta } = useChatOptions() ?? {};

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
            action: () => {
              handleVolumeUpdate('loud');
            },
            icon: currentVolumeLevel === 'loud' ? 'Checkmark' : undefined,
          },
          {
            title: 'Posts, mentions, and replies',
            action: () => {
              handleVolumeUpdate('medium');
            },
            icon: currentVolumeLevel === 'medium' ? 'Checkmark' : undefined,
          },
          {
            title: 'Only mentions and replies',
            action: () => {
              handleVolumeUpdate('soft');
            },
            icon: currentVolumeLevel === 'soft' ? 'Checkmark' : undefined,
          },
          {
            title: 'Nothing',
            action: () => {
              handleVolumeUpdate('hush');
            },
            icon: currentVolumeLevel === 'hush' ? 'Checkmark' : undefined,
          },
          {
            title: 'Back',
            action: () => {
              setPane('initial');
            },
          },
        ],
      },
    ],
    [currentVolumeLevel, handleVolumeUpdate, setPane]
  );

  const actionGroups: ActionGroup[] = useMemo(() => {
    return [
      {
        accent: 'neutral',
        actions: [
          {
            title: 'Notifications',
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
            icon: 'Pin',
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
                {
                  title: 'Edit metadata',
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
      {
        accent: 'negative',
        actions: [
          {
            title: `Leave chat`,
            action: () => {
              if (!channel) {
                return;
              }
              Alert.alert(
                `Leave ${title}?`,
                'This chat will be removed from list',
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
      },
    ];
  }, [channel, onPressChannelMembers, onPressChannelMeta, setPane, title]);
  return (
    <ChatOptionsSheetContent
      actionGroups={pane === 'initial' ? actionGroups : actionNotifications}
      title={title}
      subtitle={subtitle}
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
