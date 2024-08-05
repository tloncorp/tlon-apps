import * as db from '@tloncorp/shared/dist/db';
import * as store from '@tloncorp/shared/dist/store';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';

export type GroupOptionsContextValue = {
  pinned: db.Channel[];
  useGroup: typeof store.useGroup;
  group: db.Group | null;
  groupChannels: db.Channel[];
  onPressGroupMeta: (groupId: string) => void;
  onPressGroupMembers: (groupId: string) => void;
  onPressManageChannels: (groupId: string) => void;
  onPressInvitesAndPrivacy: (groupId: string) => void;
  onPressRoles: (groupId: string) => void;
  onPressLeave: () => Promise<void>;
  onTogglePinned: () => void;
} | null;

const GroupOptionsContext = createContext<GroupOptionsContextValue>(null);

export const useGroupOptions = () => {
  return useContext(GroupOptionsContext);
};

type GroupOptionsProviderProps = {
  children: ReactNode;
  groupId?: string;
  pinned?: db.Channel[];
  useGroup?: typeof store.useGroup;
  onPressGroupMeta?: (groupId: string) => void;
  onPressGroupMembers?: (groupId: string) => void;
  onPressManageChannels?: (groupId: string) => void;
  onPressInvitesAndPrivacy?: (groupId: string) => void;
  onPressRoles?: (groupId: string) => void;
};

export const GroupOptionsProvider = ({
  children,
  groupId,
  pinned = [],
  useGroup = store.useGroup,
  onPressGroupMeta = () => {},
  onPressGroupMembers = () => {},
  onPressManageChannels = () => {},
  onPressInvitesAndPrivacy = () => {},
  onPressRoles = () => {},
}: GroupOptionsProviderProps) => {
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

  const contextValue: GroupOptionsContextValue = groupId
    ? {
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
      }
    : null;

  return (
    <GroupOptionsContext.Provider value={contextValue}>
      {children}
    </GroupOptionsContext.Provider>
  );
};
