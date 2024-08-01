import * as ub from '../urbit';
import { StorageConfiguration, StorageCredentials } from './upload';
import { scry, subscribe } from './urbit';

export type StorageUpdateCredentials = ub.StorageUpdateCredentials & {
  type: 'storageCredentialsChanged';
};

export type StorageUpdateConfiguration = ub.StorageUpdateConfiguration & {
  type: 'storageCongfigurationChanged';
};

export type StorageUpdateCurrentBucket = ub.StorageUpdateCurrentBucket & {
  type: 'storageCurrentBucketChanged';
};

export type StorageUpdateAddBucket = ub.StorageUpdateAddBucket & {
  type: 'storageBucketAdded';
};

export type StorageUpdateRemoveBucket = ub.StorageUpdateRemoveBucket & {
  type: 'storageBucketRemoved';
};

export type StorageUpdateEndpoint = ub.StorageUpdateEndpoint & {
  type: 'storageEndpointChanged';
};

export type StorageUpdateAccessKeyId = ub.StorageUpdateAccessKeyId & {
  type: 'storageAccessKeyIdChanged';
};

export type StorageUpdateSecretAccessKey = ub.StorageUpdateSecretAccessKey & {
  type: 'storageSecretAccessKeyChanged';
};

export type StorageUpdateRegion = ub.StorageUpdateRegion & {
  type: 'storageRegionChanged';
};

export type StorageUpdateSetPresignedUrl = ub.StorageUpdateSetPresignedUrl & {
  type: 'storagePresignedUrlChanged';
};

export type StorageUpdateToggleService = ub.StorageUpdateToggleService & {
  type: 'storageServiceToggled';
};

export type StorageEventUnknown = {
  type: 'storageEventUnknown';
  data: unknown;
};

export type StorageUpdate =
  | StorageUpdateCredentials
  | StorageUpdateConfiguration
  | StorageUpdateCurrentBucket
  | StorageUpdateAddBucket
  | StorageUpdateRemoveBucket
  | StorageUpdateEndpoint
  | StorageUpdateAccessKeyId
  | StorageUpdateSecretAccessKey
  | StorageUpdateRegion
  | StorageUpdateToggleService
  | StorageUpdateSetPresignedUrl
  | StorageEventUnknown;

export const subscribeToStorageUpdates = async (
  eventHandler: (update: StorageUpdate) => void
) => {
  subscribe<ub.StorageUpdate>({ app: 'storage', path: '/all' }, (e) => {
    eventHandler(toStorageUpdate(e));
  });
};

function toStorageUpdate(e: ub.StorageUpdate): StorageUpdate {
  if ('credentials' in e) {
    return { type: 'storageCredentialsChanged', ...e };
  } else if ('configuration' in e) {
    return { type: 'storageCongfigurationChanged', ...e };
  } else if ('setCurrentBucket' in e) {
    return { type: 'storageCurrentBucketChanged', ...e };
  } else if ('addBucket' in e) {
    return { type: 'storageBucketAdded', ...e };
  } else if ('removeBucket' in e) {
    return { type: 'storageBucketRemoved', ...e };
  } else if ('setEndpoint' in e) {
    return { type: 'storageEndpointChanged', ...e };
  } else if ('setAccessKeyId' in e) {
    return { type: 'storageAccessKeyIdChanged', ...e };
  } else if ('setSecretAccessKey' in e) {
    return { type: 'storageSecretAccessKeyChanged', ...e };
  } else if ('setRegion' in e) {
    return { type: 'storageRegionChanged', ...e };
  } else if ('toggleService' in e) {
    return { type: 'storageServiceToggled', ...e };
  } else if ('setPresignedUrl' in e) {
    return { type: 'storagePresignedUrlChanged', ...e };
  } else {
    return { type: 'storageEventUnknown', data: e };
  }
}

export const getStorageConfiguration =
  async (): Promise<StorageConfiguration> => {
    const configuration = await scry<{
      'storage-update': StorageUpdateConfiguration;
    }>({
      app: 'storage',
      path: '/configuration',
    });
    return configuration['storage-update'].configuration;
  };

export const getStorageCredentials = async (): Promise<StorageCredentials> => {
  const credentials = await scry<{
    'storage-update': StorageUpdateCredentials;
  }>({
    app: 'storage',
    path: '/credentials',
  });
  return credentials['storage-update'].credentials;
};
