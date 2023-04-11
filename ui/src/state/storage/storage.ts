import _ from 'lodash';
import { enableMapSet } from 'immer';
import { BaseStorageState } from './type';
import reduce from './reducer';
import {
  createState,
  createSubscription,
  reduceStateN,
  BaseState,
} from '../base';

enableMapSet();

let numLoads = 0;

export type StorageState = BaseStorageState & BaseState<BaseStorageState>;

export const useStorage = createState<BaseStorageState>(
  'Storage',
  () => ({
    loaded: false,
    hasCredentials: false,
    s3: {
      configuration: {
        buckets: new Set(),
        currentBucket: '',
        region: '',
      },
      credentials: null,
    },
  }),
  [],
  [
    (set, get) =>
      createSubscription('s3-store', '/all', (e) => {
        const data = _.get(e, 's3-update', false);
        if (data) {
          reduceStateN(get(), data, reduce);
        }
        numLoads += 1;
        if (numLoads === 2) {
          set({ loaded: true });
        }
      }),
  ]
);
