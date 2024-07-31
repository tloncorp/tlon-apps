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
};

const GroupOptionsContext = createContext<GroupOptionsContextValue | null>(
  null
);

export const useGroupOptions = () => {
  const context = useContext(GroupOptionsContext);
  if (!context) {
    // Return null instead of throwing an error since we might try to call this
    // outside of a group context (e.g. in the BaubleHeader)
    return null;
  }
  return context;
};

export const GroupOptionsProvider = ({
  children,
  groupId,
  pinned,
  useGroup,
  onPressGroupMeta,
  onPressGroupMembers,
  onPressManageChannels,
  onPressInvitesAndPrivacy,
  onPressRoles,
}: Omit<
  GroupOptionsContextValue,
  'group' | 'groupChannels' | 'onPressLeave' | 'onTogglePinned'
> & { children: ReactNode; groupId: string }) => {
  const groupQuery = useGroup({ id: groupId });
  const group = groupQuery.data ?? null;

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

  const contextValue: GroupOptionsContextValue = {
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
  };

  return (
    <GroupOptionsContext.Provider value={contextValue}>
      {children}
    </GroupOptionsContext.Provider>
  );
};
