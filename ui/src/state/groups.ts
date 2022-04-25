import create from 'zustand';
import produce, { setAutoFreeze } from 'immer';
import { BigIntOrderedMap, udToDec } from '@urbit/api';
import bigInt from 'big-integer';
import { useCallback } from 'react';
import {Group} from '../types/groups';
import {mockGroups} from '../fixtures/groups';

interface GroupState {
  set: (fn: (sta: GroupState) => void) => void;
  groups: {
    [flag: string]: Group;
  }
};
export const useGroupState = create<GroupState>((set, get) => ({
  groups: mockGroups,
  set: (fn) => {
    set(produce(get(), fn));
  }
}));

export function useGroup(flag: string) {
  return useGroupState(useCallback(s => s.groups[flag], [flag]));
}

const selList = (s: GroupState) => Object.keys(s.groups);
export function useGroupList() {
  return useGroupState(selList);
}

