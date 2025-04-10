import { format } from 'date-fns';
import produce from 'immer';
import create from 'zustand';
import { persist } from 'zustand/middleware';

import {
  clearStorageMigration,
  createStorageKey,
  storageVersion,
} from '../logic/utils';

export type SubscriptionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface LocalState {
  browserId: string;
  currentTheme: 'light' | 'dark';
  manuallyShowTalkSunset: boolean;
  subscription: SubscriptionStatus;
  groupsLocation: string;
  messagesLocation: string;
  showDevTools: boolean;
  errorCount: number;
  airLockErrorCount: number;
  lastReconnect: number;
  inFocus: boolean;
  onReconnect: (() => void) | null;
  logs: string[];
  log: (msg: string) => void;
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
      manuallyShowTalkSunset: false,
      showDevTools: import.meta.env.DEV,
      errorCount: 0,
      airLockErrorCount: 0,
      lastReconnect: Date.now(),
      onReconnect: null,
      logs: [],
      inFocus: true,
      log: (msg: string) => {
        set(
          produce((s) => {
            s.logs.unshift(`${format(new Date(), 'HH:mm:ss')} ${msg}`);
          })
        );
      },
    }),
    {
      name: createStorageKey('local'),
      version: storageVersion,
      migrate: clearStorageMigration,
      partialize: ({ currentTheme, browserId, showDevTools }) => ({
        currentTheme,
        browserId,
        showDevTools,
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

const selManuallyShowTalkSunset = (s: LocalState) => s.manuallyShowTalkSunset;
export function useManuallyShowTalkSunset() {
  return useLocalState(selManuallyShowTalkSunset);
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

const selInFocus = (s: LocalState) => s.inFocus;
export function useInFocus() {
  return useLocalState(selInFocus);
}
