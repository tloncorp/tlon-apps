import create from 'zustand';
import { persist } from 'zustand/middleware';
import produce from 'immer';
import {
  clearStorageMigration,
  createStorageKey,
  storageVersion,
} from '../logic/utils';

export type SubscriptionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface LocalState {
  browserId: string;
  currentTheme: 'light' | 'dark';
  subscription: SubscriptionStatus;
  errorCount: number;
  airLockErrorCount: number;
  set: (f: (s: LocalState) => void) => void;
}

export const useLocalState = create<LocalState>(
  persist<LocalState>(
    (set, get) => ({
      set: (f) => set(produce(get(), f)),
      currentTheme: 'light',
      browserId: '',
      subscription: 'connected',
      errorCount: 0,
      airLockErrorCount: 0,
    }),
    {
      name: createStorageKey('local'),
      version: storageVersion,
      migrate: clearStorageMigration,
      partialize: ({ currentTheme, browserId }) => ({
        currentTheme,
        browserId,
      }),
    }
  )
);

const selBrowserId = (s: LocalState) => s.browserId;
export function useBrowserId() {
  return useLocalState(selBrowserId);
}

const selCurrentTheme = (s: LocalState) => s.currentTheme;
export function useCurrentTheme() {
  return useLocalState(selCurrentTheme);
}

export const setLocalState = (f: (s: LocalState) => void) =>
  useLocalState.getState().set(f);

const selSubscription = (s: LocalState) => s.subscription;
export function useSubscriptionStatus() {
  return useLocalState(selSubscription);
}

const selErrorCount = (s: LocalState) => s.errorCount;
export function useErrorCount() {
  return useLocalState(selErrorCount);
}

const selAirLockErrorCount = (s: LocalState) => s.airLockErrorCount;
export function useAirLockErrorCount() {
  return useLocalState(selAirLockErrorCount);
}
