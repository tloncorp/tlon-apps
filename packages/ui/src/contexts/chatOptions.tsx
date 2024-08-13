import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';

export type ChatOptionsContextValue = {
  pinned: db.Channel[];
  useGroup: typeof store.useGroup;
  group: db.Group | null;
  groupChannels: db.Channel[];
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressInvitesAndPrivacy: (groupId: string) => void;
  onPressRoles: (groupId: string) => void;
  onPressChannelMembers: (channelId: string) => void;
  onPressChannelMeta: (channelId: string) => void;
  onTogglePinned: () => void;
  onPressLeave: () => Promise<void>;
} | null;

const ChatOptionsContext = createContext<ChatOptionsContextValue>(null);

export const useChatOptions = () => {
  return useContext(ChatOptionsContext);
};

type ChatOptionsProviderProps = {
  children: ReactNode;
  groupId?: string;
  channelId?: string;
  pinned?: db.Channel[];
  useGroup?: typeof store.useGroup;
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressInvitesAndPrivacy: (groupId: string) => void;
  onPressChannelMembers: (channelId: string) => void;
  onPressChannelMeta: (channelId: string) => void;
  onPressRoles: (groupId: string) => void;
};

export const ChatOptionsProvider = ({
  children,
  groupId,
  pinned = [],
  useGroup = store.useGroup,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressInvitesAndPrivacy,
  onPressChannelMembers,
  onPressChannelMeta,
  onPressRoles,
}: ChatOptionsProviderProps) => {
  const groupQuery = useGroup({ id: groupId ?? '' });
  const group = groupId ? groupQuery.data ?? null : null;

  const groupChannels = useMemo(() => {
    return group?.channels ?? [];
  }, [group?.channels]);

  const onTogglePinned = useCallback(() => {
    if (group && group.channels[0]) {
      group.pin ? store.unpinItem(group.pin) : store.pinItem(group.channels[0]);
    }
  }, [group]);

  const onPressLeave = useCallback(async () => {
    if (group) {
      await store.leaveGroup(group.id);
    }
  }, [group]);

  const contextValue: ChatOptionsContextValue = {
    pinned,
    useGroup,
    group,
    groupChannels,
    onPressGroupMeta,
    onPressGroupMembers,
    onPressManageChannels,
    onPressInvitesAndPrivacy,
    onPressRoles,
    onPressLeave,
    onTogglePinned,
    onPressChannelMembers,
    onPressChannelMeta,
  };

  return (
    <ChatOptionsContext.Provider value={contextValue}>
      {children}
    </ChatOptionsContext.Provider>
  );
};
