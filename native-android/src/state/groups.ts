import { create } from 'zustand';
import useStore from './store';
import type { GroupChannel, Groups } from '../types/groups';

export interface GroupsState {
  groups: Groups;
  fetchAll: () => Promise<Groups>;
  fetchGroupChannel: (id: string) => Promise<GroupChannel | null>;
}

const findGroupChannel = (groups: Groups, id: string) => {
  for (const group of Object.values(groups)) {
    if (group.channels[id]) {
      return group.channels[id];
    }
  }

  return null;
};

const useGroupsState = create<GroupsState>((set, get) => ({
  groups: {},
  unknownGroups: [],
  fetchAll: async () => {
    const { api } = useStore.getState();
    if (!api) {
      throw new Error('No api found');
    }

    const groups = await api.scry<Groups>({
      app: 'groups',
      path: '/groups/light',
    });
    set((state) => ({ ...state, groups }));
    return groups;
  },
  fetchGroupChannel: async (id: string) => {
    let { groups } = get();
    const groupChannel = findGroupChannel(groups, id);
    if (groupChannel) {
      return groupChannel;
    }

    groups = await get().fetchAll();
    return findGroupChannel(groups, id);
  },
}));

export default useGroupsState;
