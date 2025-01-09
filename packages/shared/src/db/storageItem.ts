import { QueryKey, useQuery } from '@tanstack/react-query';

import { queryClient } from '../api';
import { createDevLogger } from '../debug';
import { getStorageMethods } from './getStorageMethods';

const logger = createDevLogger('keyValueStore', false);

export type StorageItemConfig<T> = {
  key: string;
  queryKey?: QueryKey;
  defaultValue: T;
  isSecure?: boolean;
  persistAfterLogout?: boolean;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
};

export type StorageItem<T> = {
  getValue: () => Promise<T>;
  setValue: (value: T | ((curr: T) => T)) => Promise<void>;
  resetValue: () => Promise<T>;
  useValue: () => T;
  useStorageItem: () => {
    value: T;
    setValue: (value: T | ((curr: T) => T)) => Promise<void>;
    resetValue: () => Promise<T>;
  };
  config: StorageItemConfig<T>;
};

const storageItems: Array<StorageItem<any>> = [];

export const createStorageItem = <T>(config: StorageItemConfig<T>) => {
  const {
    key,
    defaultValue,
    serialize = JSON.stringify,
    deserialize = JSON.parse,
  } = config;
  const storage = getStorageMethods(config.isSecure ?? false);
  let updateLock = Promise.resolve();

  const getValue = async (): Promise<T> => {
    const value = await storage.getItem(key);
    return value ? deserialize(value) : defaultValue;
  };

  const resetValue = async (): Promise<T> => {
    updateLock = updateLock.then(async () => {
      await storage.setItem(key, serialize(defaultValue));
      queryClient.invalidateQueries({ queryKey: [key] });
      logger.log(`reset value ${key}`);
    });
    await updateLock;
    return defaultValue;
  };

  const setValue = async (valueInput: T | ((curr: T) => T)): Promise<void> => {
    updateLock = updateLock.then(async () => {
      let newValue: T;
      if (valueInput instanceof Function) {
        const currValue = await getValue();
        newValue = valueInput(currValue);
      } else {
        newValue = valueInput;
      }

      await storage.setItem(key, serialize(newValue));
      queryClient.invalidateQueries({
        queryKey: config.queryKey ? config.queryKey : [key],
      });
      logger.log(`set value ${key}`, newValue);
    });
    await updateLock;
  };

  function useValue() {
    const { data: value } = useQuery({ queryKey: [key], queryFn: getValue });
    return value === undefined ? defaultValue : value;
  }

  function useStorageItem() {
    const value = useValue();
    return {
      value,
      setValue,
      resetValue,
    };
  }

  const storageItem = {
    getValue,
    setValue,
    resetValue,
    useValue,
    useStorageItem,
    config,
  };

  storageItems.push(storageItem);

  return storageItem;
};

export const clearSessionStorageItems = async (): Promise<void> => {
  const clearPromises = storageItems
    .filter((item) => !item.config.persistAfterLogout)
    .map((item) => item.resetValue());

  await Promise.all(clearPromises);
  logger.log('Cleared all non-persistent storage items');
};
