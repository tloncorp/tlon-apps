import { enableMapSet } from 'immer';
import _ from 'lodash';
import { compose } from 'lodash/fp';
import create from 'zustand';

import type {
  StorageState,
  StorageUpdate,
  StorageUpdateConfiguration,
  StorageUpdateCredentials,
} from '../../api';
import * as api from '../../api';
import { createDevLogger } from '../../debug';
import reduce from './reducer';
import { getHostingUploadURL, getIsHosted } from './utils';

const logger = createDevLogger('storage state', true);

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
  getCredentials: async () => {
    const storageUpdate = await api.scry<{
      'storage-update': StorageUpdateCredentials;
    }>({
      app: 'storage',
      path: '/credentials',
    });

    const { credentials } = storageUpdate['storage-update'];

    set({ s3: { ...get().s3, credentials } });

    return credentials;
  },
  getConfiguration: async () => {
    const storageUpdate = await api.scry<{
      'storage-update': StorageUpdateConfiguration;
    }>({
      app: 'storage',
      path: '/configuration',
    });

    const { configuration } = storageUpdate['storage-update'];

    set({ s3: { ...get().s3, configuration } });

    return configuration;
  },
  start: async () => {
    let isHosted: boolean | undefined = undefined;
    let hostingUploadURL = '';
    try {
      isHosted = await getIsHosted();
      hostingUploadURL = await getHostingUploadURL();
    } catch (e) {
      logger.error(e);
    }

    try {
      // we apparently need to specifically scry for these on android since
      // the subscription isn't working
      await get().getCredentials();
      await get().getConfiguration();
      set({
        loaded: true,
      });
    } catch (e) {
      logger.error(e);
    }

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
