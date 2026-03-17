import * as db from '@tloncorp/shared/db';
import { whichPin, doPin } from '@tloncorp/shared/logic';
import { SyncPriority, leaveGroup, leaveGroupChannel, markChannelRead, markGroupRead, pinChannel, pinGroup, respondToDMInvite, setChannelVolumeLevel, setGroupVolumeLevel, syncGroup, unpinItem, useChannel, useGroup } from '@tloncorp/shared/store';
import * as ub from '@tloncorp/api/urbit';
import { ConfirmDialog, useIsWindowNarrow } from '@tloncorp/ui';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ChatOptionsSheet } from '../components/ChatOptionsSheet';
import { InviteUsersSheet } from '../components/InviteUsersSheet';
import { useChannelTitle } from '../utils';

export type ChatOptionsContextValue = {
  useGroup: typeof useGroup;
  group?: db.Group | null;
  channel?: db.Channel | null;
  markGroupRead: () => void;
  markChannelRead: (options?: { includeThreads?: boolean }) => void;
  onPressGroupMeta: (fromBlankChannel?: boolean) => void;
  onPressGroupMembers: () => void;
  onPressManageChannels: () => void;
  onPressInvite?: () => void;
  onPressGroupPrivacy: () => void;
  onPressRoles: () => void;
  onPressChannelMembers: () => void;
  onPressChannelMeta: () => void;
  onPressChannelTemplate: () => void;
  onPressChatDetails: (chat: { type: 'group' | 'channel'; id: string; groupId?: string }) => void;
  togglePinned: () => void;
  leaveGroup: () => Promise<void>;
  leaveChannel: () => void;
  updateVolume: (level: ub.NotificationLevel | null) => void;
  setChannelSortPreference?: (sortBy: 'recency' | 'arranged') => void;
  open: (chatId: string, chatType: 'group' | 'channel') => void;
  setChat: (chat: { id: string; type: 'group' | 'channel' } | null) => void;
} | null;

const noop = () => {};
const noopAsync = async () => {};
const defaultValue: ChatOptionsContextValue = {
  useGroup: useGroup,
  group: null,
  channel: null,
  markGroupRead: noop,
  markChannelRead: noop,
  onPressGroupMeta: noop,
  onPressGroupMembers: noop,
  onPressManageChannels: noop,
  onPressInvite: noop,
  onPressGroupPrivacy: noop,
  onPressRoles: noop,
  onPressChannelMembers: noop,
  onPressChannelMeta: noop,
  onPressChannelTemplate: noop,
  onPressChatDetails: noop,
  togglePinned: noop,
  leaveGroup: noopAsync,
  leaveChannel: noop,
  updateVolume: noop,
  setChannelSortPreference: noop,
  open: noop,
  setChat: noop,
};

const ChatOptionsContext = createContext<ChatOptionsContextValue>(null);

export const useChatOptions = (disabled = false) => {
  const value = useContext(ChatOptionsContext);
  if (disabled) {
    return defaultValue;
  }
  if (!value) {
    throw new Error('useChatOptions used outside of ChatOptions context');
  }
  return value;
};

type ChatOptionsProviderProps = {
  children: ReactNode;
  useChannel?: typeof useChannel;
  useGroup?: typeof useGroup;
  onPressGroupMeta?: (groupId: string, fromBlankChannel?: boolean, fromChatDetails?: boolean) => void;
  onPressGroupMembers?: (groupId: string, fromChatDetails?: boolean) => void;
  onPressManageChannels?: (groupId: string, fromChatDetails?: boolean) => void;
  onPressInvite?: (groupId: string) => void;
  onPressGroupPrivacy?: (groupId: string, fromChatDetails?: boolean) => void;
  onPressChannelMembers?: (channelId: string) => void;
  onPressChannelMeta?: (channelId: string) => void;
  onPressChannelTemplate?: (channelId: string) => void;
  onPressRoles?: (groupId: string, fromChatDetails?: boolean) => void;
  onPressChatDetails?: (chat: {
    type: 'group' | 'channel';
    id: string;
    groupId?: string;
  }) => void;
  onSelectSort?: (sortBy: 'recency' | 'arranged') => void;
  onLeaveGroup?: () => void;
  onLeaveChannel?: (groupId: string, channelId: string) => void;
  onPressConfigureChannel?: () => void;
  onPressDeleteGroup?: () => void;
  initialChat?: {
    id: string;
    type: 'group' | 'channel';
    groupId?: string;
  };
};

export const ChatOptionsProvider = ({
  children,
  initialChat,
  useChannel = useChannel,
  useGroup = useGroup,
  onPressGroupMeta,
  onPressGroupMembers = noop,
  onPressManageChannels,
  onPressInvite,
  onPressGroupPrivacy,
  onPressChannelMembers,
  onPressChannelMeta,
  onPressChannelTemplate = noop,
  onPressRoles,
  onPressChatDetails = noop,
  onLeaveGroup: navigateOnLeave,
  onLeaveChannel: navigateToGroupOnLeave,
  onPressConfigureChannel,
}: ChatOptionsProviderProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [leaveChannelDialogOpen, setLeaveChannelDialogOpen] = useState(false);
  const [leaveChannelTitle, setLeaveChannelTitle] = useState<string | null>(
    null
  );
  const [leaveChannelData, setLeaveChannelData] = useState<db.Channel | null>(
    null
  );
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

  const closeInviteSheet = useCallback(() => {
    setInviteSheetOpen(false);
  }, []);

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

  // Defensive: restore chat from initialChat if cleared unexpectedly.
  // This handles edge cases where setChat(null) is called (e.g., when
  // ChatOptionsSheet closes) but we're still on a screen that needs
  // the chat context (e.g., after navigating to ChatDetailsScreen and back).
  // Without this, groupId becomes undefined and actions like "Customize"
  // in EmptyChannelNotice fail silently.
  useEffect(() => {
    if (chat === null && initialChat) {
      setChat(initialChat);
    }
  }, [chat, initialChat]);

  const isChannel = chat?.type === 'channel';
  const isGroup = chat?.type === 'group';

  const { data: channel } = useChannel({
    id: isChannel ? chat.id : undefined,
  });
  const channelTitle = useChannelTitle(channel ?? null);
  const groupId = isGroup
    ? chat.id
    : channel?.groupId ?? initialChat?.groupId ?? undefined;
  const channelId = isChannel ? chat.id : undefined;
  const { data: group } = useGroup({
    id: groupId,
  });

  useEffect(() => {
    async function syncGroup() {
      if (!groupId) return;

      try {
        await syncGroup(groupId, {
          priority: SyncPriority.Low,
        });
      } catch (error) {
        console.error('sync failed for', groupId, error);
      }
    }

    syncGroup();
  }, [groupId]);

  const togglePinned = useCallback(async () => {
    // Re-query to get current pin state
    let updatedChannel = channel;
    let updatedGroup = group;

    if (chat?.type === 'channel' && channel) {
      const channelWithPin = await db.getChannelWithRelations({
        id: channel.id,
      });
      if (!channelWithPin) {
        console.warn(`Channel ${channel.id} not found`);
        return;
      }
      updatedChannel = channelWithPin;
    } else if (chat?.type === 'group' && group) {
      const groupWithPin = await db.getGroup({ id: group.id });
      if (!groupWithPin) {
        console.warn(`Group ${group.id} not found`);
        return;
      }
      updatedGroup = groupWithPin;
    }

    // Use pinning logic
    const res = whichPin({
      chat,
      channel: updatedChannel,
      group: updatedGroup,
    });

    await doPin(res, {
      unpinItem: unpinItem,
      pinChannel: pinChannel,
      pinGroup: pinGroup,
    });
  }, [chat, channel, group]);

  const updateVolume = useCallback(
    (level: ub.NotificationLevel | null) => {
      if (chat?.type === 'group' && group) {
        setGroupVolumeLevel({ group, level });
      } else if (chat?.type === 'channel' && channel) {
        setChannelVolumeLevel({ channel, level });
      }
    },
    [channel, chat, group]
  );

  const leaveGroup = useCallback(async () => {
    if (groupId) {
      await leaveGroup(groupId);
    }
    navigateOnLeave?.();
    closeSheet();
  }, [closeSheet, groupId, navigateOnLeave]);

  const onLeaveChannelConfirmed = useCallback(async () => {
    if (!leaveChannelData) {
      return;
    }
    const isDm =
      leaveChannelData.type === 'dm' || leaveChannelData.type === 'groupDm';

    if (isDm) {
      // Leaving a DM - navigate to Messages tab
      respondToDMInvite({
        channel: leaveChannelData,
        accept: false,
      });
      navigateOnLeave?.();
    } else if (leaveChannelData.groupId) {
      // Leaving a channel in a group - navigate to the first available channel
      leaveGroupChannel(leaveChannelData.id);
      await navigateToGroupOnLeave?.(
        leaveChannelData.groupId,
        leaveChannelData.id
      );
    } else {
      // Fallback
      leaveGroupChannel(leaveChannelData.id);
      navigateOnLeave?.();
    }
    setLeaveChannelData(null);
    closeSheet();
  }, [leaveChannelData, closeSheet, navigateOnLeave, navigateToGroupOnLeave]);

  const leaveChannel = useCallback(() => {
    setLeaveChannelTitle(channelTitle);
    setLeaveChannelData(channel ?? null);
    setLeaveChannelDialogOpen(true);
  }, [channelTitle, channel]);

  const markGroupRead = useCallback(() => {
    if (groupId) {
      markGroupRead(groupId, true);
    }
    closeSheet();
  }, [closeSheet, groupId]);

  const markChannelRead = useCallback(
    ({ includeThreads }: { includeThreads?: boolean } = {}) => {
      if (channelId) {
        markChannelRead({
          id: channelId,
          groupId: groupId,
          includeThreads,
        });
      }
    },
    [channelId, groupId]
  );

  const setChannelSortPreference = useCallback(
    (sortBy: 'recency' | 'arranged') => {
      db.channelSortPreference.setValue(sortBy);
      closeSheet();
    },
    [closeSheet]
  );

  const handlePressInvite = useCallback(() => {
    if (groupId) {
      if (onPressInvite) {
        closeSheet();
        onPressInvite?.(groupId);
      } else {
        // if not handled by the parent, open built in invite sheet
        closeSheet();
        setTimeout(() => {
          setInviteSheetOpen(true);
        }, 300);
      }
    }
  }, [closeSheet, groupId, onPressInvite]);

  const handlePressChannelMeta = useCallback(() => {
    if (channelId) {
      onPressChannelMeta?.(channelId);
      closeSheet();
    }
  }, [channelId, closeSheet, onPressChannelMeta]);

  const handlePressGroupMeta = useCallback(
    (fromBlankChannel?: boolean) => {
      if (groupId) {
        onPressGroupMeta?.(groupId, fromBlankChannel, true);
        closeSheet();
      }
    },
    [closeSheet, groupId, onPressGroupMeta]
  );

  const handlePressManageChannels = useCallback(() => {
    if (groupId) {
      onPressManageChannels?.(groupId, true);
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
      onPressGroupMembers(groupId, true);
      closeSheet();
    }
  }, [closeSheet, groupId, onPressGroupMembers]);

  const handlePressGroupPrivacy = useCallback(() => {
    if (groupId) {
      onPressGroupPrivacy?.(groupId, true);
      closeSheet();
    }
  }, [closeSheet, groupId, onPressGroupPrivacy]);

  const handlePressGroupRoles = useCallback(() => {
    if (groupId) {
      onPressRoles?.(groupId, true);
    }
  }, [groupId, onPressRoles]);

  const handlePressChannelTemplate = useCallback(() => {
    if (channelId) {
      onPressChannelTemplate(channelId);
      closeSheet();
    }
  }, [channelId, closeSheet, onPressChannelTemplate]);

  const handlePressChatDetails = useCallback(
    (params: { type: 'group' | 'channel'; id: string; groupId?: string }) => {
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
        <>
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
          <InviteUsersSheet
            open={inviteSheetOpen}
            onOpenChange={closeInviteSheet}
            onInviteComplete={() => closeInviteSheet()}
            groupId={groupId}
          />
        </>
      )}
      <ConfirmDialog
        open={leaveChannelDialogOpen && !!leaveChannelTitle}
        onOpenChange={(open) => {
          setLeaveChannelDialogOpen(open);
          if (!open) {
            setLeaveChannelTitle(null);
            setLeaveChannelData(null);
          }
        }}
        title={`Leave ${leaveChannelTitle ?? 'channel'}?`}
        description="You will no longer receive updates from this channel."
        confirmText="Leave"
        destructive
        onConfirm={onLeaveChannelConfirmed}
      />
    </ChatOptionsContext.Provider>
  );
};
