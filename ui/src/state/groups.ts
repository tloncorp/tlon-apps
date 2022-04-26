import create from 'zustand';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useCallback, useMemo } from 'react';
import { Group, GroupDiff } from '../types/groups';
import { mockGroups } from '../fixtures/groups';
import api from '../api';
import { useParams } from 'react-router';

function groupAction(flag: string, diff: GroupDiff) {
  return {
    app: 'groups',
    mark: 'group-action',
    json: {
      flag,
      update: {
        time: '',
        diff,
      },
    },
  };
}

interface GroupState {
  set: (fn: (sta: GroupState) => void) => void;
  groups: {
    [flag: string]: Group;
  };
  delRole: (flag: string, sect: string) => Promise<void>;
  addRole: (
    flag: string,
    sect: string,
    values: {
      title: string;
      description: string;
    }
  ) => Promise<void>;
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
  addRole: async (flag, sect, meta) => {
    const diff = {
      cabal: {
        sect,
        diff: {
          add: { ...meta, image: '' },
        },
      },
    };
    await api.poke(groupAction(flag, diff));
  },
  delRole: async (flag, sect) => {
    const diff = {
      cabal: {
        sect,
        diff: { del: null },
      },
    };
    await api.poke(groupAction(flag, diff));
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
