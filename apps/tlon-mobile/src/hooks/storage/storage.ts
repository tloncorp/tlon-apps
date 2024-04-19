import * as api from '@tloncorp/shared/dist/api';
import type { StorageState, StorageUpdate } from '@tloncorp/shared/dist/urbit';
import { enableMapSet } from 'immer';
import _ from 'lodash';
import { compose } from 'lodash/fp';
import create from 'zustand';

import type { ShipInfo } from '../../contexts/ship';
import storage from '../../lib/storage';
import reduce from './reducer';

const getShipInfo = async () => {
  const shipInfo = (await storage.load({ key: 'store' })) as
    | ShipInfo
    | undefined;

  return shipInfo;
};

const getIsHosted = async () => {
  const shipInfo = await getShipInfo();
  const isHosted = shipInfo?.shipUrl?.endsWith('tlon.network');
  return isHosted;
};

export const getHostingUploadURL = async () => {
  const isHosted = await getIsHosted();
  return isHosted ? 'https://memex.tlon.network' : '';
};

enableMapSet();

const reduceStateN = <S extends Record<string, unknown>, U>(
  state: StorageState,
  data: U,
  reducers: ((payload: U, current: S) => S)[]
): void => {
  const reducer = compose(reducers.map((r) => (sta) => r(data, sta)));
  state.set(reducer);
};

let numLoads = 0;

export const useStorage = create<StorageState>((set, get) => ({
  loaded: false,
  s3: {
    configuration: {
      buckets: new Set(),
      currentBucket: '',
      region: '',
      publicUrlBase: '',
      presignedUrl: '',
      service: 'credentials',
    },
    credentials: null,
  },
  start: async () => {
    const isHosted = await getIsHosted();
    const hostingUploadURL = await getHostingUploadURL();
    api.subscribe<StorageUpdate>(
      {
        app: 'storage',
        path: '/all',
      },
      (e) => {
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
      }
    );
  },
  set,
  get,
}));
