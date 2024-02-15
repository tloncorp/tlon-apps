/* eslint-disable no-param-reassign */
import { hostingUploadURL } from '@/logic/utils';
import _ from 'lodash';

import { BaseState } from '../base';
import { BaseStorageState, StorageUpdate } from './type';

export type StorageState = BaseStorageState & BaseState<BaseStorageState>;

const credentials = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'credentials', false);
  if (data) {
    state.s3.credentials = data;
  }
  return state;
};

const configuration = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'configuration', false);
  if (data) {
    state.s3.configuration = {
      buckets: new Set(data.buckets),
      currentBucket: data.currentBucket,
      region: data.region,
      publicUrlBase: data.publicUrlBase,
      // if landscape is not up to date we need to default these so the
      // client init logic still works
      presignedUrl: data.presignedUrl || hostingUploadURL,
      service: data.service || 'credentials',
    };
  }
  return state;
};

const currentBucket = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'setCurrentBucket', false);
  if (data && state.s3) {
    state.s3.configuration.currentBucket = data;
  }
  return state;
};

const addBucket = (json: StorageUpdate, state: StorageState): StorageState => {
  const data = _.get(json, 'addBucket', false);
  if (data) {
    state.s3.configuration.buckets = state.s3.configuration.buckets.add(data);
  }
  return state;
};

const removeBucket = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'removeBucket', false);
  if (data) {
    state.s3.configuration.buckets.delete(data);
  }
  return state;
};

const endpoint = (json: StorageUpdate, state: StorageState): StorageState => {
  const data = _.get(json, 'setEndpoint', false);
  if (data && state.s3.credentials) {
    state.s3.credentials.endpoint = data;
  }
  return state;
};

const accessKeyId = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'setAccessKeyId', false);
  if (data && state.s3.credentials) {
    state.s3.credentials.accessKeyId = data;
  }
  return state;
};

const secretAccessKey = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'setSecretAccessKey', false);
  if (data && state.s3.credentials) {
    state.s3.credentials.secretAccessKey = data;
  }
  return state;
};

const region = (json: StorageUpdate, state: StorageState): StorageState => {
  const data = _.get(json, 'setRegion', false);
  if (data && state.s3.configuration) {
    state.s3.configuration.region = data;
  }
  return state;
};

const publicUrlBase = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'setPublicUrlBase', false);
  if (data && state.s3.configuration) {
    state.s3.configuration.publicUrlBase = data;
  }
  return state;
};

const presignedUrl = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'setPresignedUrl', false);
  if (data && state.s3.configuration) {
    state.s3.configuration.presignedUrl = data;
  }
  return state;
};

const toggleService = (
  json: StorageUpdate,
  state: StorageState
): StorageState => {
  const data = _.get(json, 'toggleService', false);
  if (data && state.s3.configuration) {
    state.s3.configuration.service = data;
  }
  return state;
};

const reduce = [
  credentials,
  configuration,
  currentBucket,
  addBucket,
  removeBucket,
  endpoint,
  accessKeyId,
  secretAccessKey,
  region,
  publicUrlBase,
  presignedUrl,
  toggleService,
];

export default reduce;
