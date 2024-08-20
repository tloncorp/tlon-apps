import { StorageCredentials, StorageService } from '../api/upload';

export interface StorageUpdateCredentials {
  credentials: StorageCredentials;
}

export interface StorageUpdateConfiguration {
  configuration: {
    buckets: string[];
    currentBucket: string;
    region: string;
    publicUrlBase: string;
    presignedUrl: string;
    service: StorageService;
  };
}

export interface StorageUpdateCurrentBucket {
  setCurrentBucket: string;
}

export interface StorageUpdateAddBucket {
  addBucket: string;
}

export interface StorageUpdateRemoveBucket {
  removeBucket: string;
}

export interface StorageUpdateEndpoint {
  setEndpoint: string;
}

export interface StorageUpdateAccessKeyId {
  setAccessKeyId: string;
}

export interface StorageUpdateSecretAccessKey {
  setSecretAccessKey: string;
}

export interface StorageUpdateRegion {
  setRegion: string;
}

export interface StorageUpdateToggleService {
  toggleService: StorageService;
}

export interface StorageUpdateSetPresignedUrl {
  setPresignedUrl: string;
}

export declare type StorageUpdate =
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
  | StorageUpdateSetPresignedUrl;
