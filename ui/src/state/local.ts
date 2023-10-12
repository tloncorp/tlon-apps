/* eslint-disable import/no-cycle */
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
  groupsLocation: string;
  messagesLocation: string;
  showDevTools: boolean;
  errorCount: number;
  airLockErrorCount: number;
  needsUpdate: boolean;
  lastReconnect: number;
  onReconnect: (() => void) | null;
  set: (f: (s: LocalState) => void) => void;
}

export const useLocalState = create<LocalState>(
  persist<LocalState>(
    (set, get) => ({
      set: (f) => set(produce(get(), f)),
      currentTheme: 'light',
      browserId: '',
      subscription: 'connected',
      groupsLocation: '/',
      messagesLocation: '/messages',
      showDevTools: import.meta.env.DEV,
      errorCount: 0,
      airLockErrorCount: 0,
      needsUpdate: false,
      lastReconnect: Date.now(),
      onReconnect: null,
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

const selShowDevTools = (s: LocalState) => s.showDevTools;
export function useShowDevTools() {
  return useLocalState(selShowDevTools);
}

const selBrowserId = (s: LocalState) => s.browserId;
export function useBrowserId() {
  return useLocalState(selBrowserId);
}

const selCurrentTheme = (s: LocalState) => s.currentTheme;
export function useCurrentTheme() {
  return useLocalState(selCurrentTheme);
}

const selNeedsUpdate = (s: LocalState) => s.needsUpdate;
export function useNeedsUpdate() {
  return useLocalState(selNeedsUpdate);
}

export const setLocalState = (f: (s: LocalState) => void) =>
  useLocalState.getState().set(f);

export const toggleDevTools = () =>
  setLocalState((s) => ({
    ...s,
    showDevTools: !s.showDevTools,
  }));

const selSubscriptionStatus = (s: LocalState) => ({
  subscription: s.subscription,
  errorCount: s.errorCount,
  airLockErrorCount: s.airLockErrorCount,
});
export function useSubscriptionStatus() {
  return useLocalState(selSubscriptionStatus);
}

const selLast = (s: LocalState) => s.lastReconnect;
export function useLastReconnect() {
  return useLocalState(selLast);
}
