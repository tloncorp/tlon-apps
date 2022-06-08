import {
  SettingsUpdate,
  Value,
  putEntry as doPutEntry,
  getDeskSettings,
  DeskData,
} from '@urbit/api';
import _ from 'lodash';
import {
  BaseState,
  createState,
  createSubscription,
  pokeOptimisticallyN,
  reduceStateN,
} from './base';
import apiContainer from '../api';

const { api } = apiContainer;

interface BaseSettingsState {
  display: {
    theme: 'light' | 'dark' | 'auto';
  };
  loaded: boolean;
  putEntry: (bucket: string, key: string, value: Value) => Promise<void>;
  fetchAll: () => Promise<void>;
  [ref: string]: unknown;
}

export type SettingsState = BaseSettingsState & BaseState<BaseSettingsState>;

function putBucket(json: SettingsUpdate, draft: SettingsState): SettingsState {
  const data = _.get(json, 'put-bucket', false);
  if (data) {
    draft[data['bucket-key']] = data.bucket;
  }
  return draft;
}

function delBucket(json: SettingsUpdate, draft: SettingsState): SettingsState {
  const data = _.get(json, 'del-bucket', false);
  if (data) {
    delete draft[data['bucket-key']];
  }
  return draft;
}

function putEntry(json: SettingsUpdate, draft: any): SettingsState {
  const data: Record<string, string> = _.get(json, 'put-entry', false);
  if (data) {
    if (!draft[data['bucket-key']]) {
      draft[data['bucket-key']] = {};
    }
    draft[data['bucket-key']][data['entry-key']] = data.value;
  }
  return draft;
}

function delEntry(json: SettingsUpdate, draft: any): SettingsState {
  const data = _.get(json, 'del-entry', false);
  if (data) {
    delete draft[data['bucket-key']][data['entry-key']];
  }
  return draft;
}

export const reduceUpdate = [putBucket, delBucket, putEntry, delEntry];

export const useSettingsState = createState<BaseSettingsState>(
  'Settings',
  (set, get) => ({
    display: {
      theme: 'auto',
    },
    loaded: false,
    putEntry: async (bucket, key, val) => {
      const poke = doPutEntry(window.desk, bucket, key, val);
      await pokeOptimisticallyN(useSettingsState, poke, reduceUpdate);
    },
    fetchAll: async () => {
      const result = (await api.scry<DeskData>(getDeskSettings(window.desk)))
        .desk;
      const newState = {
        ..._.mergeWith(get(), result, (obj, src) =>
          _.isArray(src) ? src : undefined
        ),
        loaded: true,
      };
      set(newState);
    },
  }),
  [],
  [
    (set, get) =>
      createSubscription('settings-store', `/desk/${window.desk}`, (e) => {
        const data = _.get(e, 'settings-event', false);
        if (data) {
          reduceStateN(get(), data, reduceUpdate);
          set({ loaded: true });
        }
      }),
  ]
);

const selTheme = (s: SettingsState) => s.display.theme;
export function useTheme() {
  return useSettingsState(selTheme);
}
