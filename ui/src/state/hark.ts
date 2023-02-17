import _ from 'lodash';
import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce from 'immer';
import create from 'zustand';
import { Blanket, Carpet, Flag, HarkAction, Rope, Seam } from '@/types/hark';
import api from '@/api';
import { decToUd } from '@urbit/api';
import { asyncForEach } from '@/lib';
import useSubscriptionState from './subscription';

export interface HarkState {
  set: (fn: (sta: HarkState) => void) => void;
  batchSet: (fn: (sta: HarkState) => void) => void;
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
  groupSubs: Flag[];
  /** start: fetches app-wide notifications and subscribes to updates */
  start: () => Promise<void>;
  /** retrieve: refreshes app-wide notifications to latest  */
  retrieve: () => Promise<void>;
  /** retrieveGroup: fetches group's notifications and adds to "subs" */
  retrieveGroup: (flag: Flag) => Promise<void>;
  /** releaseGroup: removes updates from happening */
  releaseGroup: (flag: Flag) => Promise<void>;
  update: (group: string | null) => Promise<void>;
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
  carpet: emptyCarpet({ desk: window.desk }),
  blanket: emptyBlanket({ desk: window.desk }),
  textiles: {},
  groupSubs: [],
  start: async () => {
    get().retrieve();

    api.subscribe({
      app: 'hark',
      path: '/ui',
      event: (event: HarkAction) => {
        if ('add-yarn' in event) {
          get().update(null);
        }
      },
    });
  },
  update: async (group) => {
    const { groupSubs, retrieve, retrieveGroup } = get();
    await retrieve();

    await asyncForEach(
      groupSubs.filter((g) => !group || group === g),
      retrieveGroup
    );
  },
  retrieve: async () => {
    const carpet = await api.scry<Carpet>({
      app: 'hark',
      path: `/desk/${window.desk}/latest`,
    });

    const blanket = await api.scry<Blanket>({
      app: 'hark',
      path: `/desk/${window.desk}/quilt/${decToUd(carpet.stitch.toString())}`,
    });

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

    const blanket = await api.scry<Blanket>({
      app: 'hark',
      path: `/group/${flag}/quilt/${decToUd(carpet.stitch.toString())}`,
    });

    get().batchSet((draft) => {
      draft.textiles[flag] = {
        carpet,
        blanket,
      };

      if (!get().groupSubs.includes(flag)) {
        draft.groupSubs.push(flag);
      }
    });
  },
  releaseGroup: async (flag) => {
    get().batchSet((draft) => {
      const index = draft.groupSubs.indexOf(flag);

      if (index !== -1) {
        draft.groupSubs.splice(index, 1);
      }
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

          await get().update(rope.group);
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

          await get().update(('group' in seam && seam.group) || null);
          resolve();
        },
      });
    }),
}));

export default useHarkState;
