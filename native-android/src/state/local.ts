import { create } from 'zustand';
import produce from 'immer';

export type SubscriptionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface LocalState {
  currentTheme: 'light' | 'dark';
  subscription: SubscriptionStatus;
  errorCount: number;
  airLockErrorCount: number;
  set: (f: (s: LocalState) => void) => void;
}

export const useLocalState = create<LocalState>((set, get) => ({
  set: f => set(produce(get(), f)),
  currentTheme: 'light',
  subscription: 'connected',
  errorCount: 0,
  airLockErrorCount: 0
}));

const selCurrentTheme = (s: LocalState) => s.currentTheme;
export function useCurrentTheme() {
  return useLocalState(selCurrentTheme);
}

export const setLocalState = (f: (s: LocalState) => void) =>
  useLocalState.getState().set(f);

const selSubscriptionStatus = (s: LocalState) => ({
  subscription: s.subscription,
  errorCount: s.errorCount,
  airLockErrorCount: s.airLockErrorCount
});
export function useSubscriptionStatus() {
  return useLocalState(selSubscriptionStatus);
}
