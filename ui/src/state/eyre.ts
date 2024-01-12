import Urbit from '@urbit/http-api';
import produce from 'immer';
import create from 'zustand';

export type ChannelStatus =
  | 'initial'
  | 'opening'
  | 'active'
  | 'reconnecting'
  | 'reconnected'
  | 'errored';

export interface Fact {
  id: number;
  time: number;
  data: any;
}

export interface AnError {
  time: number;
  msg: string;
}

export interface IdStatus {
  current: number;
  lastHeard: number;
  lastAcknowledged: number;
}

export interface Subscription {
  id: number;
  app?: string;
  path?: string;
}

interface UrbitLike {
  on: Urbit['on'];
  reset: Urbit['reset'];
}

export interface StartParams {
  api: UrbitLike;
  onReset?: () => void;
}

export interface EyreState {
  listening: UrbitLike | null;
  open: boolean;
  toggle: (open: boolean) => void;
  channel: string;
  status: ChannelStatus;
  facts: Fact[];
  errors: AnError[];
  idStatus: IdStatus;
  subscriptions: Record<string, Subscription>;
  onReset: () => void;
  update: (cb: (draft: EyreState) => void) => void;
  start: ({ api, onReset }: StartParams) => void;
}

export const useEyreState = create<EyreState>((set, get) => ({
  listening: null,
  open: false,
  channel: '',
  status: 'initial',
  idStatus: {
    current: 0,
    lastHeard: -1,
    lastAcknowledged: -1,
  },
  facts: [],
  errors: [],
  subscriptions: {},
  onReset: () => null,
  update(cb) {
    set(produce(cb));
  },
  toggle: (open) => {
    get().update((draft) => {
      draft.open = open;
    });
  },
  start: ({ api, onReset }) => {
    const { update, listening } = get();
    if (api === listening) {
      // same API object, no need to add listeners
      return;
    }
    update((draft) => {
      draft.onReset = () => {
        if (onReset) {
          onReset();
        }
        api.reset();
      };

      draft.listening = api;
    });

    api.on('id-update', (status) => {
      update((draft) => {
        draft.idStatus = {
          ...draft.idStatus,
          ...status,
        };
      });
    });
    api.on('status-update', ({ status }) => {
      update((draft) => {
        draft.status = status;
      });
    });
    api.on('subscription', ({ status, ...sub }) => {
      update((draft) => {
        if (status === 'open') {
          draft.subscriptions[sub.id.toString()] = sub;
        } else {
          delete draft.subscriptions[sub.id.toString()];
        }
      });
    });
    api.on('fact', (fact) => {
      update((draft) => {
        draft.facts.unshift(fact);
      });
    });
    api.on('error', (err) => {
      update((draft) => {
        draft.errors.unshift(err);
      });
    });
    api.on('reset', ({ uid }) => {
      update((draft) => {
        draft.channel = uid;
        draft.status = 'initial';
        draft.idStatus = {
          current: 0,
          lastHeard: -1,
          lastAcknowledged: -1,
        };
        draft.facts = [];
        draft.errors = [];
      });
    });
    api.on('init', ({ uid, subscriptions }) => {
      update((draft) => {
        draft.channel = uid;
        draft.subscriptions =
          subscriptions.reduce(
            (subs, s) => {
              // eslint-disable-next-line no-param-reassign
              subs[s.id.toString()] = s;
              return subs;
            },
            {} as Record<string, Subscription>
          ) || {};
      });
    });
  },
}));
