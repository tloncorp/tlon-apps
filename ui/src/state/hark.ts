import { unstable_batchedUpdates as batchUpdates } from 'react-dom';
import produce from 'immer';
import create from 'zustand';
import { Blanket, Carpet, Flag, HarkAction, Rope, Seam } from '@/types/hark';
import api from '@/api';

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
  groupSubs: {
    [flag: Flag]: number;
  };
  /** start: fetches app-wide notifications and subscribes to updates */
  start: () => void;
  /** retrieve: refreshes app-wide notifications to latest  */
  retrieve: () => void;
  /** retrieveGroup: fetches group's notifications */
  retrieveGroup: (flag: Flag) => void;
  sawRope: (rope: Rope) => void;
  sawSeam: (seam: Seam) => void;
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
  groupSubs: {},
  start: () => {
    get().retrieve();

    api.subscribe({
      app: 'hark',
      path: '/ui',
      event: (event: HarkAction) => {
        console.log(event, get().carpet);
        get().retrieve();
        // if ('add-yarn' in event) {
        // }
        // if ('saw-seam' in event) {
        // }
        // if ('saw-rope' in event) {
        // }
      },
    });
  },
  retrieve: async () => {
    const carpet = await api.scry<Carpet>({
      app: 'hark',
      path: `/desk/${window.desk}/latest`,
    });

    const blanket = await api.scry<Blanket>({
      app: 'hark',
      path: `/desk/${window.desk}/quilt/${carpet.stitch}`,
    });

    console.log(carpet, blanket);
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
      path: `/group/${flag}/quilt/${carpet.stitch}`,
    });

    get().batchSet((draft) => {
      draft.textiles[flag] = {
        carpet,
        blanket,
      };
    });
  },
  sawRope: (rope) => {
    api.poke(
      harkAction({
        'saw-rope': rope,
      })
    );
  },
  sawSeam: (seam) => {
    api.poke(
      harkAction({
        'saw-seam': seam,
      })
    );
  },
}));

export default useHarkState;
