import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as ub from '@tloncorp/shared/urbit';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert } from 'react-native';
import { isWeb } from 'tamagui';

import { ChatOptionsSheet } from '../components/ChatOptionsSheet';
import { useChannelTitle } from '../utils';

export type ChatOptionsContextValue = {
  useGroup: typeof store.useGroup;
  group?: db.Group | null;
  channel?: db.Channel | null;
  markGroupRead: () => void;
  markChannelRead: () => void;
  onPressGroupMeta: () => void;
  onPressGroupMembers: () => void;
  onPressManageChannels: () => void;
  onPressInvite?: () => void;
  onPressGroupPrivacy: () => void;
  onPressRoles: () => void;
  onPressChannelMembers: () => void;
  onPressChannelMeta: () => void;
  onPressChannelTemplate: () => void;
  togglePinned: () => void;
  leaveGroup: () => Promise<void>;
  leaveChannel: () => void;
  updateVolume: (level: ub.NotificationLevel | null) => void;
  setChannelSortPreference?: (sortBy: 'recency' | 'arranged') => void;
  open: (chatId: string, chatType: 'group' | 'channel') => void;
} | null;

const ChatOptionsContext = createContext<ChatOptionsContextValue>(null);

export const useChatOptions = () => {
  const value = useContext(ChatOptionsContext);
  if (!value) {
    throw new Error('useChatOptions used outside of ChatOptions context');
  }
  return value;
};

type ChatOptionsProviderProps = {
  children: ReactNode;
  useChannel?: typeof store.useChannel;
  useGroup?: typeof store.useGroup;
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressInvite?: (group: db.Group) => void;
  onPressGroupPrivacy: (groupId: string) => void;
  onPressChannelMembers: (channelId: string) => void;
  onPressChannelMeta: (channelId: string) => void;
  onPressChannelTemplate: (channelId: string) => void;
  onPressRoles: (groupId: string) => void;
  onSelectSort?: (sortBy: 'recency' | 'arranged') => void;
  onLeaveGroup?: () => void;
  initialChat?: {
    id: string;
    type: 'group' | 'channel';
  };
};

export const ChatOptionsProvider = ({
  children,
  initialChat,
  useChannel = store.useChannel,
  useGroup = store.useGroup,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressInvite,
  onPressGroupPrivacy,
  onPressChannelMembers,
  onPressChannelMeta,
  onPressChannelTemplate,
  onPressRoles,
  onLeaveGroup: navigateOnLeave,
}: ChatOptionsProviderProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chat, setChat] = useState<{
    id: string;
    type: 'group' | 'channel';
  } | null>(initialChat ?? null);

  const openSheet = useCallback(
    (chatId: string, chatType: 'group' | 'channel') => {
      setChat({
        id: chatId,
        type: chatType,
      });
      setSheetOpen(true);
    },
    []
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const isChannel = chat?.type === 'channel';
  const isGroup = chat?.type === 'group';

  const { data: channel } = useChannel({
    id: isChannel ? chat.id : undefined,
  });
  const channelTitle = useChannelTitle(channel ?? null);
  const groupId = isGroup ? chat.id : channel?.groupId ?? undefined;
  const { data: group } = useGroup({
    id: groupId,
  });

  useEffect(() => {
    if (groupId) {
      store.syncGroup(groupId, { priority: store.SyncPriority.Medium });
    }
  }, [groupId]);

  const togglePinned = useCallback(() => {
    if (group && group.channels?.[0]) {
      group.pin ? store.unpinItem(group.pin) : store.pinGroup(group);
    }
  }, [group]);

  const updateVolume = useCallback(
    (level: ub.NotificationLevel | null) => {
      if (chat?.type === 'group' && group) {
        store.setGroupVolumeLevel({ group, level });
      } else if (chat?.type === 'channel' && channel) {
        store.setChannelVolumeLevel({ channel, level });
      }
    },
    [channel, chat, group]
  );

  const leaveGroup = useCallback(async () => {
    if (group) {
      await store.leaveGroup(group.id);
    }
    navigateOnLeave?.();
    closeSheet();
  }, [closeSheet, group, navigateOnLeave]);

  const onLeaveChannelConfirmed = useCallback(() => {
    if (!channel) {
      return;
    }
    if (channel.type === 'dm' || channel.type === 'groupDm') {
      store.respondToDMInvite({
        channel,
        accept: false,
      });
    } else {
      store.leaveGroupChannel(channel.id);
    }
    closeSheet();
  }, [channel, closeSheet]);

  const leaveChannel = useCallback(() => {
    if (isWeb) {
      return onLeaveChannelConfirmed();
    }
    Alert.alert(
      `Leave ${channelTitle}?`,
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
          onPress: onLeaveChannelConfirmed,
        },
      ]
    );
  }, [channelTitle, onLeaveChannelConfirmed]);

  const markGroupRead = useCallback(() => {
    if (group) {
      store.markGroupRead(group, true);
    }
    closeSheet();
  }, [closeSheet, group]);

  const markChannelRead = useCallback(() => {
    if (channel && !channel.isPendingChannel) {
      store.markChannelRead(channel);
    }
  }, [channel]);

  const setChannelSortPreference = useCallback(
    (sortBy: 'recency' | 'arranged') => {
      db.channelSortPreference.setValue(sortBy);
      closeSheet();
    },
    [closeSheet]
  );

  const handlePressInvite = useCallback(() => {
    if (group) {
      onPressInvite?.(group);
      closeSheet();
    }
  }, [closeSheet, group, onPressInvite]);

  const handlePressChannelMeta = useCallback(() => {
    if (channel) {
      onPressChannelMeta?.(channel?.id);
      closeSheet();
    }
  }, [channel, closeSheet, onPressChannelMeta]);

  const handlePressGroupMeta = useCallback(() => {
    if (group) {
      onPressGroupMeta?.(group.id);
      closeSheet();
    }
  }, [closeSheet, group, onPressGroupMeta]);

  const handlePressManageChannels = useCallback(() => {
    if (group) {
      onPressManageChannels?.(group.id);
      closeSheet();
    }
  }, [group, onPressManageChannels, closeSheet]);

  const handlePressChannelMembers = useCallback(() => {
    if (channel) {
      onPressChannelMembers?.(channel.id);
      closeSheet();
    }
  }, [channel, closeSheet, onPressChannelMembers]);

  const handlePressGroupMembers = useCallback(() => {
    if (group) {
      onPressGroupMembers?.(group.id);
      closeSheet();
    }
  }, [closeSheet, group, onPressGroupMembers]);

  const handlePressGroupPrivacy = useCallback(() => {
    if (group) {
      onPressGroupPrivacy?.(group.id);
      closeSheet();
    }
  }, [closeSheet, group, onPressGroupPrivacy]);

  const handlePressGroupRoles = useCallback(() => {
    if (group) {
      onPressRoles?.(group.id);
    }
  }, [group, onPressRoles]);

  const handlePressChannelTemplate = useCallback(() => {
    if (channel) {
      onPressChannelTemplate(channel.id);
      closeSheet();
    }
  }, [channel, onPressChannelTemplate]);

  const contextValue: ChatOptionsContextValue = useMemo(
    () => ({
      useGroup,
      group,
      channel,
      markGroupRead,
      markChannelRead,
      onPressGroupMeta: handlePressGroupMeta,
      onPressChannelTemplate: handlePressChannelTemplate,
      onPressGroupMembers: handlePressGroupMembers,
      onPressManageChannels: handlePressManageChannels,
      onPressInvite: handlePressInvite,
      onPressGroupPrivacy: handlePressGroupPrivacy,
      onPressRoles: handlePressGroupRoles,
      leaveGroup,
      leaveChannel,
      togglePinned,
      updateVolume,
      open: openSheet,
      onPressChannelMembers: handlePressChannelMembers,
      onPressChannelMeta: handlePressChannelMeta,
      setChannelSortPreference,
    }),
    [
      useGroup,
      group,
      channel,
      markGroupRead,
      markChannelRead,
      handlePressGroupMeta,
      handlePressGroupMembers,
      handlePressManageChannels,
      handlePressInvite,
      handlePressGroupPrivacy,
      handlePressGroupRoles,
      onPressChannelTemplate,
      leaveGroup,
      leaveChannel,
      togglePinned,
      updateVolume,
      openSheet,
      handlePressChannelMembers,
      handlePressChannelMeta,
      setChannelSortPreference,
    ]
  );

  return (
    <ChatOptionsContext.Provider value={contextValue}>
      {children}
      <ChatOptionsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        chat={chat}
      />
    </ChatOptionsContext.Provider>
  );
};
