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
  pinned: db.Pin[];
  useGroup: typeof store.useGroup;
  group: db.Group | null;
  groupChannels: db.Channel[];
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressGroupPrivacy: (groupId: string) => void;
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

export type ChatOptionsContextValueProps = {
  groupId?: string;
  channelId?: string;
  pinned: db.Pin[];
  useGroup?: typeof store.useGroup;
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressGroupPrivacy: (groupId: string) => void;
  onPressChannelMembers: (channelId: string) => void;
  onPressChannelMeta: (channelId: string) => void;
  onPressRoles: (groupId: string) => void;
};

type ChatOptionsProviderProps = ChatOptionsContextValueProps & {
  children: ReactNode;
};

export const ChatOptionsProvider = (props: ChatOptionsProviderProps) => {
  const contextValue = useChatOptionsContextValue(props);
  return (
    <ChatOptionsContext.Provider value={contextValue}>
      {props.children}
    </ChatOptionsContext.Provider>
  );
};

// remove use of this free from its context once android bug is fixed
// https://github.com/reactwg/react-native-new-architecture/discussions/186
export const useChatOptionsContextValue = ({
  groupId,
  pinned = [],
  useGroup = store.useGroup,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressGroupPrivacy,
  onPressChannelMembers,
  onPressChannelMeta,
  onPressRoles,
}: ChatOptionsContextValueProps): ChatOptionsContextValue => {
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
    onPressGroupPrivacy,
    onPressRoles,
    onPressLeave,
    onTogglePinned,
    onPressChannelMembers,
    onPressChannelMeta,
  };

  return contextValue;
};
