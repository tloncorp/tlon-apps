import _ from 'lodash';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce from 'immer';
import create from 'zustand';
import { Blanket, Carpet, Flag, HarkAction, Rope, Seam } from '@/types/hark';
import api from '@/api';
import { decToUd } from '@urbit/api';
import useSubscriptionState from './subscription';

export interface HarkState {
  set: (fn: (sta: HarkState) => void) => void;
  batchSet: (fn: (sta: HarkState) => void) => void;
  loaded: boolean;
  /** carpet: represents unread notifications at the app level */
  carpet: Carpet;
  /** blanket: represents read notifications at the app level */
  blanket: Blanket;
  /** textiles: represents notifications at the group level */
  textiles: {
    [flag: Flag]: {
      carpet: Carpet;
      blanket: Blanket;
    };
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

export function emptyCarpet(seam: Seam) {
  return {
    seam,
    yarns: {},
    cable: [],
    stitch: 0,
  };
}

export function emptyBlanket(seam: Seam) {
  return {
    seam,
    yarns: {},
    quilt: {},
  };
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
  carpet: emptyCarpet({ desk: window.desk }),
  blanket: emptyBlanket({ desk: window.desk }),
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
    const carpet = await api
      .scry<Carpet>({
        app: 'hark',
        path: `/desk/${window.desk}/latest`,
      })
      .catch(() => emptyCarpet({ desk: window.desk }));

    const quilt = carpet.stitch === 0 ? '0' : decToUd(carpet.stitch.toString());
    const blanket = await api
      .scry<Blanket>({
        app: 'hark',
        path: `/desk/${window.desk}/quilt/${quilt}`,
      })
      .catch(() => emptyBlanket({ desk: window.desk }));

    get().batchSet((draft) => {
      draft.carpet = carpet;
      draft.blanket = blanket;
    });
  },
  retrieveGroup: async (flag) => {
    const carpet = await api.scry<Carpet>({
      app: 'hark',
      path: `/group/${flag}/latest`,
    });

    const quilt = carpet.stitch === 0 ? '0' : decToUd(carpet.stitch.toString());
    const blanket = await api.scry<Blanket>({
      app: 'hark',
      path: `/group/${flag}/quilt/${quilt}`,
    });

    get().batchSet((draft) => {
      draft.textiles[flag] = {
        carpet,
        blanket,
      };
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
