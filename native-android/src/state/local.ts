import { create } from 'zustand';
import produce from 'immer';

export type SubscriptionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface LocalState {
  subscription: SubscriptionStatus;
  errorCount: number;
  airLockErrorCount: number;
  set: (f: (s: LocalState) => void) => void;
}

export const useLocalState = create<LocalState>((set, get) => ({
  set: f => set(produce(get(), f)),
  subscription: 'connected',
  errorCount: 0,
  airLockErrorCount: 0
}));

const selSubscriptionStatus = (s: LocalState) => ({
  subscription: s.subscription,
  errorCount: s.errorCount,
  airLockErrorCount: s.airLockErrorCount
});
export function useSubscriptionStatus() {
  return useLocalState(selSubscriptionStatus);
}
