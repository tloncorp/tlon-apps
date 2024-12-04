import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { ChatOptionsSheet } from '../components/ChatOptionsSheet';

export type ChatOptionsContextValue = {
  useGroup: typeof store.useGroup;
  group?: db.Group | null;
  groupChannels: db.Channel[];
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressInvite?: (group: db.Group) => void;
  onPressGroupPrivacy: (groupId: string) => void;
  onPressRoles: (groupId: string) => void;
  onPressChannelMembers: (channelId: string) => void;
  onPressChannelMeta: (channelId: string) => void;
  onTogglePinned: () => void;
  onPressLeave: () => Promise<void>;
  onSelectSort?: (sortBy: 'recency' | 'arranged') => void;
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
  onPressRoles: (groupId: string) => void;
  onSelectSort?: (sortBy: 'recency' | 'arranged') => void;
  onLeaveGroup?: () => void;
  onPressConfigureChannel?: () => void;
};

export const ChatOptionsProvider = ({
  children,
  useChannel = store.useChannel,
  useGroup = store.useGroup,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressInvite,
  onPressGroupPrivacy,
  onPressChannelMembers,
  onPressChannelMeta,
  onPressRoles,
  onLeaveGroup: navigateOnLeave,
  onPressConfigureChannel,
}: ChatOptionsProviderProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chat, setChat] = useState<{
    id: string;
    type: 'group' | 'channel';
  } | null>(null);

  const isChannel = chat?.type === 'channel';
  const isGroup = chat?.type === 'group';

  const { data: channel } = useChannel({
    id: isChannel ? chat.id : undefined,
  });
  const { data: group } = useGroup({
    id: isGroup ? chat.id : channel?.groupId ?? undefined,
  });

  const groupChannels = useMemo(() => {
    return group?.channels ?? [];
  }, [group?.channels]);

  const onTogglePinned = useCallback(() => {
    if (group && group.channels?.[0]) {
      group.pin ? store.unpinItem(group.pin) : store.pinGroup(group);
    }
  }, [group]);

  const onPressLeave = useCallback(async () => {
    if (group) {
      await store.leaveGroup(group.id);
    }
    navigateOnLeave?.();
  }, [group, navigateOnLeave]);

  const onSelectSort = useCallback((sortBy: 'recency' | 'arranged') => {
    db.channelSortPreference.setValue(sortBy);
  }, []);

  const open = useCallback((chatId: string, chatType: 'group' | 'channel') => {
    setChat({
      id: chatId,
      type: chatType,
    });
    setSheetOpen(true);
  }, []);

  const contextValue: ChatOptionsContextValue = useMemo(
    () => ({
      useGroup,
      group,
      groupChannels,
      onPressGroupMeta,
      onPressGroupMembers,
      onPressManageChannels,
      onPressInvite,
      onPressGroupPrivacy,
      onPressRoles,
      onPressLeave,
      onTogglePinned,
      onPressChannelMembers,
      onPressChannelMeta,
      onSelectSort,
      open,
    }),
    [
      group,
      groupChannels,
      onPressChannelMembers,
      onPressChannelMeta,
      onPressGroupMembers,
      onPressGroupMeta,
      onPressGroupPrivacy,
      onPressInvite,
      onPressLeave,
      onPressManageChannels,
      onPressRoles,
      onSelectSort,
      onTogglePinned,
      open,
      useGroup,
    ]
  );

  return (
    <ChatOptionsContext.Provider value={contextValue}>
      {children}
      <ChatOptionsSheet
        open={sheetOpen}
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
    </ChatOptionsContext.Provider>
  );
};
