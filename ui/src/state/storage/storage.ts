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
    // XXX: This is for PR testing, the current case is covered by the "s3"
    // backend. The endpoint and token are supposed to come from the ship, like
    // the S3 credentials.
    backend: 'tlon-hosting',
    tlonHosting: {
      endpoint: 'http://localhost:8888',
      token: 'token',
    },
    s3: {
      configuration: {
        buckets: new Set(),
        currentBucket: '',
        region: '',
      },
      credentials: null,
    },
  }),
  {},
  [
    (set, get) =>
      createSubscription('storage', '/all', (e) => {
        const data = _.get(e, 'storage-update', false);
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
