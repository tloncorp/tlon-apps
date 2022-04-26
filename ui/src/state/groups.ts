import create from 'zustand';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useCallback, useMemo } from 'react';
import { Group } from '../types/groups';
import { mockGroups } from '../fixtures/groups';
import api from '../api';
import { useParams } from 'react-router';

interface GroupState {
  set: (fn: (sta: GroupState) => void) => void;
  groups: {
    [flag: string]: Group;
  };
  create: (req: {
    name: string;
    title: string;
    description: string;
  }) => Promise<void>;
  fetchAll: () => Promise<void>;
}
export const useGroupState = create<GroupState>((set, get) => ({
  groups: mockGroups,
  create: async (req) => {
    await api.poke({
      app: 'groups',
      mark: 'group-create',
      json: req,
    });
  },
  fetchAll: async () => {
    const groups = await api.scry({
      app: 'groups',
      path: '/groups',
    });
    set((s) => ({
      ...s,
      groups,
    }));
  },
  set: (fn) => {
    set(produce(get(), fn));
  },
}));

export function useGroup(flag: string) {
  return useGroupState(useCallback((s) => s.groups[flag], [flag]));
}

export function useRouteGroup() {
  const { ship, name } = useParams();
  return useMemo(() => `${ship}/${name}`, [ship, name]);
}

const selList = (s: GroupState) => Object.keys(s.groups);
export function useGroupList() {
  return useGroupState(selList);
}
