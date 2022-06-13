import produce from 'immer';
import _ from 'lodash';
import { useCallback } from 'react';
import create from 'zustand';

interface NavStore {
  location: string;
  flag: string;
  setLocationMain: () => void;
  setLocationGroups: (flag: string) => void;
  setLocationDM: (flag?: string) => void;
} 

const useNavStore = create<NavStore>((set) => ({
  location: 'main',
  flag: '',
  setLocationMain: () => set({location: 'main'}),
  setLocationGroups: (flag) => set({location: 'group', flag}),
  setLocationDM: () => set({location: 'dm'}),
}));

export default useNavStore;

