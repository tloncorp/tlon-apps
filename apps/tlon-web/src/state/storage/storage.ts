import { enableMapSet } from 'immer';
import _ from 'lodash';

import { hostingUploadURL, isHosted } from '@/logic/utils';

import {
  BaseState,
  createState,
  createSubscription,
  reduceStateN,
} from '../base';
import reduce from './reducer';
import { BaseStorageState } from './type';

enableMapSet();

let numLoads = 0;

export type StorageState = BaseStorageState & BaseState<BaseStorageState>;

export const useStorage = createState<BaseStorageState>(
  'Storage',
  () => ({
    loaded: false,
    s3: {
      configuration: {
        buckets: new Set(),
        currentBucket: '',
        region: '',
        publicUrlBase: '',
        presignedUrl: hostingUploadURL,
        service: 'credentials',
      },
      credentials: null,
    },
  }),
  {
    partialize: () => ({}),
  },
  [
    (set, get) =>
      createSubscription('storage', '/all', (e) => {
        const data = _.get(e, 'storage-update', false);
        if (data) {
          reduceStateN(get(), data, reduce);
        }
        numLoads += 1;
        if (numLoads === 2) {
          const {
            s3: { credentials, configuration },
          } = get();

          if (!credentials?.endpoint && isHosted) {
            set({
              loaded: true,
              s3: {
                credentials,
                configuration: {
                  ...configuration,
                  presignedUrl: configuration.presignedUrl || hostingUploadURL,
                  service: 'presigned-url',
                },
              },
            });
          } else {
            set({ loaded: true });
          }
        }
      }),
  ]
);
