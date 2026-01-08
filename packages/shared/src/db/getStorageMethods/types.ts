import type { StorageItemConfig } from '../storageItem';

export interface StorageMethods {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export type GetStorageMethods = <T>(
  config: Pick<StorageItemConfig<T>, 'isSecure' | 'isLarge'>
) => StorageMethods;
