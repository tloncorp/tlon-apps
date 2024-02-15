// Special thanks @willbach of @uqbar-dao
import api from '@/api';
import create, { SetState } from 'zustand';

interface Outgoing {
  lists: string[];
  ack: boolean | null;
}

export interface PalsRequests {
  incoming: { [key: string]: boolean };
  outgoing: { [key: string]: Outgoing | null };
}

export interface MutualPals {
  [key: string]: { lists: string[] } | null;
}

interface PalsState {
  loading: boolean;
  installed: boolean;
  pals: PalsRequests;
  mutuals: MutualPals;
  pending: string[];
  fetchPals: () => Promise<void>;
  addPal: (ship: string, tags?: string[]) => Promise<void>;
  removePal: (ship: string) => Promise<void>;
  initializePals: () => Promise<void>;
  set: SetState<PalsState>;
}

const usePalsState = create<PalsState>((set, get) => ({
  loading: true,
  installed: false,
  pals: { incoming: {}, outgoing: {} },
  mutuals: {},
  pending: [],
  fetchPals: async () => {
    try {
      const data: any = await api.scry({ app: 'pals', path: '/json' });
      if (!data.incoming) {
        data.incoming = {};
      }
      if (!data.outgoing) {
        data.outgoing = {};
      }
      const mutuals = Object.keys(data.outgoing).reduce(
        (acc, cur) => {
          if (data?.incoming?.[cur]) {
            // eslint-disable-next-line no-param-reassign
            acc[cur] = data?.outgoing?.[cur]?.lists;
          }
          return acc;
        },
        {} as { [key: string]: any }
      );
      set({
        pals: data,
        mutuals,
        installed: true,
        loading: false,
      });
    } catch (err) {
      console.warn('PALS SCRY ERROR:', err);
      set({ loading: false });
    }
  },
  addPal: async (ship: string, tags = []) => {
    await api.poke({
      app: 'pals',
      mark: 'pals-command',
      json: {
        meet: { ship, in: tags },
      },
    });

    set({
      pals: {
        ...get().pals,
        outgoing: {
          ...get().pals.outgoing,
          [ship]: { ack: true, lists: tags },
        },
      },
    });
  },
  removePal: async (ship: string) => {
    await api.poke({
      app: 'pals',
      mark: 'pals-command',
      json: {
        part: { ship, in: [] },
      },
    });
  },
  initializePals: async () => {
    await get().fetchPals();

    api.subscribe({
      app: 'pals',
      path: '/leeches',
      event: (data: any) => {
        usePalsState.getState().set((draft) => {
          const { near } = data;

          if (!draft.mutuals[near]) {
            draft.pals.incoming[near] = true;

            if (draft.pals.outgoing[near]) {
              draft.mutuals[near] = { lists: [] };
            } else {
              draft.pending = draft.pending
                .filter((s) => s !== near)
                .concat([near]);
            }
          }
        });
      },
    });

    api.subscribe({
      app: 'pals',
      path: '/targets',
      event: (data: any) => {
        usePalsState.getState().set((draft) => {
          const { meet, part } = data;
          if (meet) {
            if (!draft.mutuals[meet]) {
              draft.pals.outgoing[meet] = { ack: true, lists: [] };

              if (draft.pals.incoming[meet]) {
                draft.mutuals[meet] = { lists: [] };
              }
            }
          } else if (part) {
            draft.mutuals[part] = null;
            draft.pals.outgoing[part] = null;
          }
        });
      },
    });
  },
  set,
}));

const selPals = (state: PalsState) => state.pals;
export function usePals() {
  return usePalsState(selPals);
}

const selMutuals = (state: PalsState) => state.mutuals;
export function useMutuals() {
  return usePalsState(selMutuals);
}

export default usePalsState;
