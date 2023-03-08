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
  wait: (callback: () => void, phase: number) => Promise<string>;
  start: (phase: number) => void;
  next: () => void;
}

const MAX_PHASE = 5;

const useSchedulerStore = create<SchedulerStore>((set, get) => ({
  phase: 0,
  waiting: {},
  next: () => {
    const { waiting, phase } = get();

    if (phase === MAX_PHASE) {
      return;
    }

    set(
      produce((draft) => {
        draft.phase += 1;
        console.log('advancing to phase', draft.phase);
      })
    );
  },
  start: (phase) => {
    const waiters = get().waiting[phase];
    console.log(
      `executing phase ${phase}:`,
      waiters?.map((w) => w.id)
    );
    waiters?.forEach((w) => {
      w.callback();
    });

    setTimeout(() => get().next(), 100);
  },
  wait: (cb, phase) => {
    return new Promise((resolve) => {
      const id = Date.now().toString();
      const { phase: p } = get();

      console.log('adding', id, 'current', p, 'requested', phase);
      if (phase <= p) {
        cb();

        console.log('phase', phase, 'already passed, executing');
        resolve(id);
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
              cb();
              resolve(id);
            },
          });
        })
      );
    });
  },
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
