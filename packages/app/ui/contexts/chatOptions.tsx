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
import useIsWindowNarrow from '@tloncorp/ui';
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
  onPressChatDetails: (chat: { type: 'group' | 'channel'; id: string }) => void;
  togglePinned: () => void;
  leaveGroup: () => Promise<void>;
  leaveChannel: () => void;
  updateVolume: (level: ub.NotificationLevel | null) => void;
  setChannelSortPreference?: (sortBy: 'recency' | 'arranged') => void;
  open: (chatId: string, chatType: 'group' | 'channel') => void;
  setChat: (chat: { id: string; type: 'group' | 'channel' } | null) => void;
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
  onPressInvite?: (groupId: string) => void;
  onPressGroupPrivacy: (groupId: string) => void;
  onPressChannelMembers: (channelId: string) => void;
  onPressChannelMeta: (channelId: string) => void;
  onPressChannelTemplate: (channelId: string) => void;
  onPressRoles: (groupId: string) => void;
  onPressChatDetails: (chat: { type: 'group' | 'channel'; id: string }) => void;
  onSelectSort?: (sortBy: 'recency' | 'arranged') => void;
  onLeaveGroup?: () => void;
  onPressConfigureChannel?: () => void;
  onPressDeleteGroup?: () => void;
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
  onPressChatDetails,
  onLeaveGroup: navigateOnLeave,
  onPressConfigureChannel,
}: ChatOptionsProviderProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chat, setChat] = useState<{
    id: string;
    type: 'group' | 'channel';
  } | null>(initialChat ?? null);
  const isWindowNarrow = useIsWindowNarrow();

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
    return true;
  }, []);

  const updateChat = useCallback(
    (newChat: { id: string; type: 'group' | 'channel' } | null) => {
      setChat(newChat);
    },
    []
  );

  const isChannel = chat?.type === 'channel';
  const isGroup = chat?.type === 'group';

  const { data: channel } = useChannel({
    id: isChannel ? chat.id : undefined,
  });
  const channelTitle = useChannelTitle(channel ?? null);
  const groupId = isGroup ? chat.id : channel?.groupId ?? undefined;
  const channelId = isChannel ? chat.id : undefined;
  const { data: group } = useGroup({
    id: groupId,
  });

  useEffect(() => {
    async function syncGroup() {
      if (!groupId) return;

      try {
        await store.syncGroup(groupId, {
          priority: store.SyncPriority.Low,
        });
      } catch (error) {
        console.error('sync failed for', groupId, error);
      }
    }

    syncGroup();
  }, [groupId, group]);

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
    if (groupId) {
      await store.leaveGroup(groupId);
    }
    navigateOnLeave?.();
    closeSheet();
  }, [closeSheet, groupId, navigateOnLeave]);

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
    if (groupId) {
      store.markGroupRead(groupId, true);
    }
    closeSheet();
  }, [closeSheet, groupId]);

  const markChannelRead = useCallback(() => {
    if (channelId) {
      store.markChannelRead({ id: channelId, groupId: groupId });
    }
  }, [channelId, groupId]);

  const setChannelSortPreference = useCallback(
    (sortBy: 'recency' | 'arranged') => {
      db.channelSortPreference.setValue(sortBy);
      closeSheet();
    },
    [closeSheet]
  );

  const handlePressInvite = useCallback(() => {
    if (groupId) {
      onPressInvite?.(groupId);
      closeSheet();
    }
  }, [closeSheet, groupId, onPressInvite]);

  const handlePressChannelMeta = useCallback(() => {
    if (channelId) {
      onPressChannelMeta?.(channelId);
      closeSheet();
    }
  }, [channelId, closeSheet, onPressChannelMeta]);

  const handlePressGroupMeta = useCallback(() => {
    if (groupId) {
      onPressGroupMeta?.(groupId);
      closeSheet();
    }
  }, [closeSheet, groupId, onPressGroupMeta]);

  const handlePressManageChannels = useCallback(() => {
    if (groupId) {
      onPressManageChannels?.(groupId);
      closeSheet();
    }
  }, [groupId, onPressManageChannels, closeSheet]);

  const handlePressChannelMembers = useCallback(() => {
    if (channelId) {
      onPressChannelMembers?.(channelId);
      closeSheet();
    }
  }, [channelId, closeSheet, onPressChannelMembers]);

  const handlePressGroupMembers = useCallback(() => {
    if (groupId) {
      onPressGroupMembers(groupId);
      closeSheet();
    }
  }, [closeSheet, groupId, onPressGroupMembers]);

  const handlePressGroupPrivacy = useCallback(() => {
    if (groupId) {
      onPressGroupPrivacy?.(groupId);
      closeSheet();
    }
  }, [closeSheet, groupId, onPressGroupPrivacy]);

  const handlePressGroupRoles = useCallback(() => {
    if (groupId) {
      onPressRoles?.(groupId);
    }
  }, [groupId, onPressRoles]);

  const handlePressChannelTemplate = useCallback(() => {
    if (channelId) {
      onPressChannelTemplate(channelId);
      closeSheet();
    }
  }, [channelId, closeSheet, onPressChannelTemplate]);

  const handlePressChatDetails = useCallback(
    (params: { type: 'group' | 'channel'; id: string }) => {
      onPressChatDetails(params);
      closeSheet();
    },
    [closeSheet, onPressChatDetails]
  );

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
      onPressChatDetails: handlePressChatDetails,
      leaveGroup,
      leaveChannel,
      togglePinned,
      updateVolume,
      open: openSheet,
      onPressChannelMembers: handlePressChannelMembers,
      onPressChannelMeta: handlePressChannelMeta,
      setChannelSortPreference,
      setChat: updateChat,
    }),
    [
      useGroup,
      group,
      channel,
      markGroupRead,
      markChannelRead,
      handlePressGroupMeta,
      handlePressChannelTemplate,
      handlePressGroupMembers,
      handlePressManageChannels,
      handlePressInvite,
      handlePressGroupPrivacy,
      handlePressGroupRoles,
      handlePressChatDetails,
      leaveGroup,
      leaveChannel,
      togglePinned,
      updateVolume,
      openSheet,
      handlePressChannelMembers,
      handlePressChannelMeta,
      setChannelSortPreference,
      updateChat,
    ]
  );

  return (
    <ChatOptionsContext.Provider value={contextValue}>
      {children}
      {isWindowNarrow && (
        <ChatOptionsSheet
          open={sheetOpen && (chat?.type === 'channel' ? !!channel : !!group)}
          onOpenChange={setSheetOpen}
          chat={chat}
          onPressConfigureChannel={
            onPressConfigureChannel == null
              ? undefined
              : () => {
                  onPressConfigureChannel();
                  setSheetOpen(false);
                }
          }
        />
      )}
    </ChatOptionsContext.Provider>
  );
};
