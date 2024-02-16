import { Pike, Pikes, getPikes, scryLag } from '@urbit/api';
import produce from 'immer';
import { useCallback } from 'react';
import create from 'zustand';

import api from '@/api';

interface KilnState {
  pikes: Pikes;
  loaded: boolean;
  lag: boolean;
  fetchLag: () => Promise<void>;
  fetchPikes: () => Promise<void>;
  set: (s: KilnState) => void;
  initializeKiln: () => Promise<void>;
}
const useKilnState = create<KilnState>((set, get) => ({
  pikes: {},
  lag: false,
  loaded: false,
  fetchPikes: async () => {
    const pikes = await api.scry<Pikes>(getPikes);
    set({ pikes, loaded: true });
  },
  fetchLag: async () => {
    const lag = await api.scry<boolean>(scryLag);
    set({ lag });
  },
  set: produce(set),
  initializeKiln: async () => {
    await get().fetchLag();
    await get().fetchPikes();
  },
}));

const selPikes = (s: KilnState) => s.pikes;
export function usePikes(): Pikes {
  return useKilnState(selPikes);
}

export function usePike(desk: string): Pike | undefined {
  return useKilnState(useCallback((s) => s.pikes[desk], [desk]));
}

const selLag = (s: KilnState) => s.lag;
export function useLag() {
  return useKilnState(selLag);
}

const selLoaded = (s: KilnState) => s.loaded;
export function useKilnLoaded() {
  return useKilnState(selLoaded);
}

export default useKilnState;
