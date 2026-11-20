import type { StorageItemConfig } from '../storageItem';

export interface StorageMethods<V = string> {
  getItem: (key: string) => Promise<V | null>;
  setItem: (key: string, value: V) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export type GetStorageMethods = <T>(
  config: Pick<StorageItemConfig<T>, 'isSecure' | 'isLarge'>
) => StorageMethods;
