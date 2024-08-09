import { sync } from '@tloncorp/shared';
import type * as db from '@tloncorp/shared/dist/db';
import * as logic from '@tloncorp/shared/dist/logic';
import * as store from '@tloncorp/shared/dist/store';
import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { useSheet } from 'tamagui';

import { useCalm, useChatOptions, useCurrentUserId } from '../contexts';
import { useCopy } from '../hooks/useCopy';
import * as utils from '../utils';
import { ActionGroup, ActionSheet } from './ActionSheetV2';
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
  return groupQuery.data ? (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <GroupOptions group={groupQuery.data} />
    </ActionSheet>
  ) : null;
}

export function GroupOptions({ group }: { group: db.Group }) {
  const currentUser = useCurrentUserId();
  const sheet = useSheet();
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  const {
    onPressGroupMeta,
    onPressManageChannels,
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

  const { didCopy: didCopyRef, doCopy: copyRef } = useCopy(
    logic.getGroupReferencePath(group.id)
  );

  const actionGroups = useMemo(() => {
    const actionGroups: ActionGroup[] = [
      {
        accent: 'neutral',
        actions: [
          {
            title: isPinned ? 'Unpin' : 'Pin',
            action: onTogglePinned,
          },
          {
            title: 'Copy group reference',
            action: () => copyRef(),
            icon: didCopyRef ? 'Checkmark' : 'Copy',
          },
        ],
      },
    ];

    if (group && currentUserIsAdmin) {
      actionGroups.push({
        accent: 'neutral',
        actions: [
          {
            title: 'Manage channels',
            action: () => {
              sheetRef.current.setOpen(false);
              onPressManageChannels?.(group.id);
            },
            icon: 'ChevronRight',
          },
          {
            title: 'Edit metadata',
            action: () => {
              sheetRef.current.setOpen(false);
              onPressGroupMeta?.(group.id);
            },
            icon: 'ChevronRight',
          },
        ],
      });
    }

    if (group && !group.currentUserIsHost) {
      actionGroups.push({
        accent: 'negative',
        actions: [
          {
            title: 'Leave group',
            icon: 'LogOut',
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
    didCopyRef,
    group,
    currentUserIsAdmin,
    copyRef,
    onPressManageChannels,
    onPressGroupMeta,
    onPressLeave,
  ]);

  const memberCount = group?.members?.length ?? 0;
  const title = group?.title ?? 'Loading…';

  return (
    <>
      <ActionSheet.Header>
        {group && <ListItem.GroupIcon model={group} />}
        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          <ListItem.Subtitle>
            Group with {memberCount} members
          </ListItem.Subtitle>
        </ListItem.MainContent>
      </ActionSheet.Header>
      <ActionSheet.ScrollView>
        {actionGroups.map((group, i) => {
          return (
            <ActionSheet.ActionGroup key={i} accent={group.accent}>
              {group.actions.map((action, index) => (
                <ActionSheet.Action key={index} action={action} />
              ))}
            </ActionSheet.ActionGroup>
          );
        })}
      </ActionSheet.ScrollView>
    </>
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
  const channelQuery = store.useChannelWithLastPostAndMembers({
    id: channelId,
  });
  return channelQuery.data ? (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ChannelOptions channel={channelQuery.data} />
    </ActionSheet>
  ) : null;
}

export function ChannelOptions({ channel }: { channel: db.Channel }) {
  const { data: group } = store.useGroup({
    id: channel?.groupId ?? undefined,
  });
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

  const actionGroups: ActionGroup[] = useMemo(() => {
    return [
      {
        accent: 'neutral',
        actions: [
          {
            title: channel?.volumeSettings?.isMuted ? 'Unmute' : 'Mute',
            action: () => {
              if (!channel) {
                return;
              }
              channel?.volumeSettings?.isMuted
                ? store.unmuteChat(channel)
                : store.muteChat(channel);
            },
          },
          {
            title: channel?.pin ? 'Unpin' : 'Pin',
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
                  icon: 'ChevronRight',
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
                  icon: 'ChevronRight',
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
  }, [channel, onPressChannelMembers, onPressChannelMeta, title]);

  return (
    <>
      <ActionSheet.Header>
        {channel && <ListItem.ChannelIcon model={channel} />}
        <ListItem.MainContent>
          <ListItem.Title>{title}</ListItem.Title>
          <ListItem.Subtitle>{subtitle}</ListItem.Subtitle>
        </ListItem.MainContent>
      </ActionSheet.Header>
      <ActionSheet.ScrollView>
        {actionGroups.map((group, i) => {
          return (
            <ActionSheet.ActionGroup key={i} accent={group.accent}>
              {group.actions.map((action, index) => (
                <ActionSheet.Action key={index} action={action} />
              ))}
            </ActionSheet.ActionGroup>
          );
        })}
      </ActionSheet.ScrollView>
    </>
  );
}
