import { useQuery } from '@tanstack/react-query';
import { sync } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as logic from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { ChevronLeft } from '../assets/icons';
import { useChatOptions, useCurrentUserId } from '../contexts';
import * as utils from '../utils';
import { useIsAdmin } from '../utils';
import { Action, ActionGroup, ActionSheet } from './ActionSheet';
import { IconButton } from './IconButton';
import { ListItem } from './ListItem';

export type ChatType = 'group' | db.ChannelType;

export type ChatOptionsSheetMethods = {
  open: (chatId: string, chatType: ChatType, unreadCount?: number) => void;
};

export type ChatOptionsSheetRef = React.Ref<ChatOptionsSheetMethods>;

type ChatOptionsSheetProps = {
  // We pass in setSortBy from GroupChannelsScreenView to live-update the sort
  // preference in the channel list.
  setSortBy?: (sortBy: db.ChannelSortPreference) => void;
};

const ChatOptionsSheetComponent = React.forwardRef<
  ChatOptionsSheetMethods,
  ChatOptionsSheetProps
>(function ChatOptionsSheetImpl(props, ref) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<{
    type: ChatType;
    id: string;
    unreadCount?: number;
  } | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      open: (chatId, chatType, unreadCount) => {
        setOpen(true);
        setChat({ id: chatId, type: chatType, unreadCount });
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
        setSortBy={props.setSortBy}
        unreadCount={chat.unreadCount}
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
});

export const ChatOptionsSheet = React.memo(ChatOptionsSheetComponent);

export function GroupOptionsSheetLoader({
  groupId,
  open,
  onOpenChange,
  setSortBy,
  unreadCount,
}: {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setSortBy?: (sortBy: db.ChannelSortPreference) => void;
  unreadCount?: number;
}) {
  const groupQuery = store.useGroup({ id: groupId });
  const [pane, setPane] = useState<
    'initial' | 'edit' | 'notifications' | 'sort'
  >('initial');
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
      <GroupOptions
        group={groupQuery.data}
        pane={pane}
        setPane={setPane}
        setSortBy={setSortBy}
        onOpenChange={onOpenChange}
        unreadCount={unreadCount}
      />
    </ActionSheet>
  ) : null;
}

export function GroupOptions({
  group,
  pane,
  setPane,
  setSortBy,
  onOpenChange,
  unreadCount,
}: {
  group: db.Group;
  pane: 'initial' | 'edit' | 'notifications' | 'sort';
  setPane: (pane: 'initial' | 'edit' | 'notifications' | 'sort') => void;
  setSortBy?: (sortBy: db.ChannelSortPreference) => void;
  onOpenChange: (open: boolean) => void;
  unreadCount?: number;
}) {
  const currentUser = useCurrentUserId();
  const { data: currentVolumeLevel } = store.useGroupVolumeLevel(group.id);

  const {
    onPressGroupMembers,
    onPressGroupMeta,
    onPressManageChannels,
    onPressInvite,
    onPressGroupPrivacy,
    onPressLeave,
    onTogglePinned,
    onSelectSort,
  } = useChatOptions() ?? {};

  useEffect(() => {
    sync.syncGroup(group.id, { priority: store.SyncPriority.High });
  }, [group]);

  const isPinned = group?.pin;

  const currentUserIsAdmin = useIsAdmin(group.id, currentUser);

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

  const actionEdit = useMemo(() => {
    const metadataAction: Action = {
      title: 'Edit group info',
      description: 'Change name, description, and image',
      action: () => {
        onOpenChange(false);
        onPressGroupMeta?.(group.id);
      },
      endIcon: 'ChevronRight',
    };

    const manageChannelsAction: Action = {
      title: 'Manage channels',
      description: 'Add or remove channels in this group',
      action: () => {
        onOpenChange(false);
        onPressManageChannels?.(group.id);
      },
      endIcon: 'ChevronRight',
    };

    const managePrivacyAction: Action = {
      title: 'Privacy',
      description: 'Change who can find or join this group',
      action: () => {
        onOpenChange(false);
        onPressGroupPrivacy?.(group.id);
      },
      endIcon: 'ChevronRight',
    };
    const actionEdit: ActionGroup[] = [
      {
        accent: 'neutral',
        actions: [metadataAction, manageChannelsAction, managePrivacyAction],
      },
    ];
    return actionEdit;
  }, [
    group.id,
    onPressGroupMeta,
    onPressGroupPrivacy,
    onPressManageChannels,
    onOpenChange,
  ]);

  const { data: groupUnread } = useQuery({
    queryKey: ['groupUnread', group.id],

    queryFn: async () => db.getGroupUnread({ groupId: group.id }),
  });

  const handleMarkAllRead = useCallback(() => {
    store.markGroupRead(group, true);
    onOpenChange(false);
  }, [group, onOpenChange]);

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
          ...(unreadCount === 0 || groupUnread?.count === 0
            ? []
            : [
                {
                  title: 'Mark all as read',
                  action: () => {
                    handleMarkAllRead();
                  },
                },
              ]),
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

    if (group.channels && group.channels.length > 1) {
      actionGroups[0].actions.push({
        title: 'Sort channels',
        endIcon: 'ChevronRight',
        action: () => {
          setPane('sort');
        },
      });
    }

    const editAction: Action = {
      title: 'Edit group',
      action: () => {
        setPane('edit');
      },
      endIcon: 'ChevronRight',
    };

    const goToMembersAction: Action = {
      title: 'Members',
      endIcon: 'ChevronRight',
      action: () => {
        onPressGroupMembers?.(group.id);
        onOpenChange(false);
      },
    };

    const inviteAction: Action = {
      title: 'Invite people',
      action: () => {
        onOpenChange(false);
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
        actions: [editAction],
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
              onOpenChange(false);
              onPressLeave?.();
            },
          },
        ],
      });
    }
    return actionGroups;
  }, [
    group,
    unreadCount,
    groupUnread?.count,
    isPinned,
    onTogglePinned,
    currentUserIsAdmin,
    setPane,
    handleMarkAllRead,
    onPressGroupMembers,
    onOpenChange,
    onPressInvite,
    onPressLeave,
  ]);

  const actionSort: ActionGroup[] = useMemo(() => {
    return [
      {
        accent: 'neutral',
        actions: [
          {
            title: 'Sort by recency',
            action: () => {
              onSelectSort?.('recency');
              setSortBy?.('recency');
              onOpenChange(false);
            },
          },
          {
            title: 'Sort by arrangement',
            action: () => {
              onSelectSort?.('arranged');
              setSortBy?.('arranged');
              onOpenChange(false);
            },
          },
        ],
      },
    ];
  }, [onSelectSort, setSortBy, onOpenChange]);

  const memberCount = group?.members?.length
    ? group.members.length.toLocaleString()
    : 0;
  const title = group?.title ?? 'Loading…';
  const privacy = group?.privacy
    ? group.privacy.charAt(0).toUpperCase() + group.privacy.slice(1)
    : '';
  const subtitle = memberCount
    ? `${privacy} group with ${memberCount} member${group.members?.length === 1 ? '' : 's'}`
    : '';
  return (
    <ChatOptionsSheetContent
      actionGroups={
        pane === 'initial'
          ? actionGroups
          : pane === 'notifications'
            ? actionNotifications
            : pane === 'edit'
              ? actionEdit
              : pane === 'sort'
                ? actionSort
                : []
      }
      title={
        pane === 'initial'
          ? title
          : pane === 'notifications'
            ? 'Notifications for ' + title
            : pane === 'edit'
              ? 'Edit ' + title
              : pane === 'sort'
                ? 'Sort channels in ' + title
                : ''
      }
      subtitle={
        pane === 'initial'
          ? subtitle
          : pane === 'notifications'
            ? 'Set what you want to be notified about'
            : pane === 'sort'
              ? 'Choose your display preference'
              : pane === 'edit'
                ? 'Edit group details'
                : ''
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
        onOpenChange={onOpenChange}
      />
    </ActionSheet>
  ) : null;
}

export function ChannelOptions({
  channel,
  pane,
  setPane,
  onOpenChange,
}: {
  channel: db.Channel;
  pane: 'initial' | 'notifications';
  setPane: (pane: 'initial' | 'notifications') => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: group } = store.useGroup({
    id: channel?.groupId ?? undefined,
  });
  const { data: currentVolumeLevel } = store.useChannelVolumeLevel(channel.id);
  const currentUser = useCurrentUserId();
  const {
    onPressChannelMembers,
    onPressChannelMeta,
    onPressManageChannels,
    onPressInvite,
    onPressLeave,
  } = useChatOptions() ?? {};

  const currentUserIsHost = useMemo(
    () => group?.currentUserIsHost ?? false,
    [group?.currentUserIsHost]
  );

  const currentUserIsAdmin = useIsAdmin(channel.groupId ?? '', currentUser);

  const title = utils.useChannelTitle(channel);

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

  const handleMarkRead = useCallback(() => {
    if (channel && !channel.isPendingChannel) {
      store.markChannelRead(channel);
    }
  }, [channel]);

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
                : store.pinChannel(channel);
            },
          },
        ],
      },
      ...((channel.unread?.count ?? 0) > 0
        ? [
            {
              accent: 'neutral',
              actions: [
                {
                  title: 'Mark as read',
                  action: () => {
                    handleMarkRead(), onOpenChange(false);
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
                  title: 'Edit group info',
                  endIcon: 'ChevronRight',
                  action: () => {
                    if (!channel) {
                      return;
                    }
                    onPressChannelMeta?.(channel.id);
                    onOpenChange(false);
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
                    onOpenChange(false);
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
                    onOpenChange(false);
                  },
                },
              ],
            } as ActionGroup,
          ]
        : []),
      // TODO: redefine in a more readable way.
      ...(group &&
      !['groupDm', 'dm'].includes(channel.type) &&
      (group.privacy === 'public' ||
        (currentUserIsAdmin &&
          ['private', 'secret'].includes(group.privacy ?? '')))
        ? [
            {
              accent: 'neutral',
              actions: [
                {
                  title: 'Invite people',
                  action: () => {
                    onOpenChange(false);
                    onPressInvite?.(group);
                  },
                  endIcon: 'ChevronRight',
                },
              ],
            } as ActionGroup,
          ]
        : []),
      ...(group &&
      !['groupDm', 'dm'].includes(channel.type) &&
      !currentUserIsAdmin &&
      ['private', 'secret'].includes(group.privacy ?? '')
        ? [
            {
              accent: 'disabled',
              actions: [
                {
                  title: 'Invites disabled',
                  description: 'Only admins may invite people to this group.',
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
                    if (!isWeb) {
                      Alert.alert(
                        `Leave ${title}?`,
                        'You will no longer receive updates from this channel.',
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
                              onOpenChange(false);
                              if (
                                channel.type === 'dm' ||
                                channel.type === 'groupDm'
                              ) {
                                store.respondToDMInvite({
                                  channel,
                                  accept: false,
                                });
                              } else {
                                store.leaveGroupChannel(channel.id);
                              }
                            },
                          },
                        ]
                      );
                      return;
                    }
                    onOpenChange(false);
                    if (channel.type === 'dm' || channel.type === 'groupDm') {
                      store.respondToDMInvite({
                        channel,
                        accept: false,
                      });
                    } else {
                      store.leaveGroupChannel(channel.id);
                    }
                  },
                },
              ],
            } as ActionGroup,
          ]
        : []),
    ];
  }, [
    channel,
    currentUserIsAdmin,
    group,
    currentUserIsHost,
    setPane,
    handleMarkRead,
    onOpenChange,
    onPressChannelMeta,
    onPressChannelMembers,
    onPressManageChannels,
    onPressInvite,
    title,
  ]);

  const displayTitle = useMemo((): string => {
    if (pane === 'initial') {
      return title ?? '';
    }
    if (title == null) {
      return 'Notifications';
    } else {
      return 'Notifications for ' + title;
    }
  }, [title, pane]);

  return (
    <ChatOptionsSheetContent
      actionGroups={pane === 'initial' ? actionGroups : actionNotifications}
      title={displayTitle}
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
        <ActionSheet.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          <ListItem.Subtitle $gtSm={{ maxWidth: 100 }}>
            {subtitle}
          </ListItem.Subtitle>
        </ActionSheet.MainContent>
      </ActionSheet.Header>
      <ActionSheet.ScrollableContent>
        <ActionSheet.SimpleActionGroupList actionGroups={actionGroups} />
      </ActionSheet.ScrollableContent>
    </>
  );
}
