import produce from 'immer';
import { useCallback, useEffect } from 'react';
import create from 'zustand';

interface Waiter {
  id: string;
  phase: number;
  callback: () => void;
}

interface SchedulerStore {
  phase: number;
  waiting: Record<number, Waiter[]>;
  wait: <T>(callback: () => T, phase: number) => Promise<T>;
  start: (phase: number) => void;
  next: () => void;
  reset: () => void;
}

const MAX_PHASE = 5;

const useSchedulerStore = create<SchedulerStore>((set, get) => ({
  phase: 0,
  waiting: {},
  reset: () => {
    set({ phase: 0, waiting: {} });
  },
  next: () => {
    const { waiting, phase } = get();

    if (phase === MAX_PHASE) {
      return;
    }

    set(
      produce((draft) => {
        draft.phase += 1;
      })
    );
  },
  start: (phase) => {
    const waiters = get().waiting[phase];
    waiters?.forEach((w) => {
      w.callback();
    });

    set(
      produce((draft: SchedulerStore) => {
        delete draft.waiting[phase];
      })
    );

    setTimeout(() => get().next(), 16);
  },
  wait: (cb, phase) =>
    new Promise((resolve) => {
      const id = Date.now().toString();
      const { phase: p } = get();

      if (phase <= p) {
        resolve(cb());
        return;
      }

      set(
        produce((draft) => {
          if (!draft.waiting[phase]) {
            draft.waiting[phase] = [];
          }

          draft.waiting[phase].push({
            id,
            phase,
            callback: () => {
              resolve(cb());
            },
          });
        })
      );
    }),
}));

export default useSchedulerStore;

export function useScheduler() {
  const { phase, start } = useSchedulerStore(
    useCallback((s: SchedulerStore) => ({ phase: s.phase, start: s.start }), [])
  );

  useEffect(() => {
    start(phase);
  }, [phase, start]);
}
