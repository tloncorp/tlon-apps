import _ from 'lodash';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce from 'immer';
import create from 'zustand';
import { Flag, HarkAction, Rope, Seam, Skein } from '@/types/hark';
import api from '@/api';
import { asyncWithDefault } from '@/logic/utils';
import useSubscriptionState from './subscription';

export interface HarkState {
  set: (fn: (sta: HarkState) => void) => void;
  batchSet: (fn: (sta: HarkState) => void) => void;
  loaded: boolean;
  /** skeins: notifications at the app level */
  skeins: Skein[];
  /** textiles: represents notifications at the group level */
  textiles: {
    [flag: Flag]: Skein[];
  };
  /** start: fetches app-wide notifications and subscribes to updates */
  start: () => Promise<void>;
  /** retrieve: refreshes app-wide notifications to latest  */
  retrieve: () => Promise<void>;
  /** retrieveGroup: fetches group's notifications */
  retrieveGroup: (flag: Flag) => Promise<void>;
  sawRope: (rope: Rope, update?: boolean) => Promise<void>;
  sawSeam: (seam: Seam) => Promise<void>;
}

function harkAction(action: HarkAction) {
  return {
    app: 'hark',
    mark: 'hark-action',
    json: action,
  };
}

const useHarkState = create<HarkState>((set, get) => ({
  set: (fn) => {
    set(produce(get(), fn));
  },
  batchSet: (fn) => {
    batchUpdates(() => {
      get().set(fn);
    });
  },
  loaded: false,
  skeins: [],
  textiles: {},
  start: async () => {
    const { retrieve } = get();
    retrieve();

    await api.subscribe({
      app: 'hark',
      path: '/ui',
      event: (event: HarkAction) => {
        if ('add-yarn' in event) {
          retrieve();
        }
      },
    });
    set({ loaded: true });
  },
  retrieve: async () => {
    const skeins = await asyncWithDefault(
      () =>
        api.scry<Skein[]>({
          app: 'hark',
          path: `/desk/${window.desk}/skeins`,
        }),
      []
    );

    get().batchSet((draft) => {
      draft.skeins = skeins;
    });
  },
  retrieveGroup: async (flag) => {
    const skeins = await asyncWithDefault(
      () =>
        api.scry<Skein[]>({
          app: 'hark',
          path: `/group/${flag}/skeins`,
        }),
      []
    );

    get().batchSet((draft) => {
      draft.textiles[flag] = skeins;
    });
  },
  sawRope: async (rope, update = true) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...harkAction({
          'saw-rope': rope,
        }),
        onError: reject,
        onSuccess: async () => {
          if (!update) {
            resolve();
            return;
          }

          await useSubscriptionState
            .getState()
            .track('hark/ui', (event: HarkAction) => {
              return (
                'saw-rope' in event && event['saw-rope'].thread === rope.thread
              );
            });

          await get().retrieve();
          resolve();
        },
      });
    }),
  sawSeam: async (seam) =>
    new Promise<void>((resolve, reject) => {
      api.poke({
        ...harkAction({
          'saw-seam': seam,
        }),
        onError: reject,
        onSuccess: async () => {
          await useSubscriptionState
            .getState()
            .track('hark/ui', (event: HarkAction) => {
              return 'saw-seam' in event && _.isEqual(event['saw-seam'], seam);
            });

          await get().retrieve();
          resolve();
        },
      });
    }),
}));

export default useHarkState;
