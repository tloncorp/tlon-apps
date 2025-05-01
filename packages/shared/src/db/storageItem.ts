import { QueryKey, useQuery } from '@tanstack/react-query';

import { queryClient } from '../api';
import { createDevLogger } from '../debug';
import { Stringified } from '../utils';
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
    await updateLock;
    const value = (await storage.getItem(key)) as Stringified<T> | null;

    if (!value) {
      return defaultValue;
    }

    try {
      const deserializedValue = deserialize(value);

      // Check to handle migration from a previous storage library
      // that prefixed all keys
      if (
        deserializedValue &&
        typeof deserializedValue === 'object' &&
        'rawData' in deserializedValue
      ) {
        return deserializedValue.rawData as T;
      }
      return deserializedValue;
    } catch (e) {
      // Handle migration from previous secure storage implementation which
      // didn't serialize values on write
      if (
        config.isSecure &&
        typeof config.defaultValue === 'string' &&
        value.length > 0
      ) {
        await setValue(value as unknown as T);
        return value as unknown as T;
      } else {
        // In other cases of deserialization failure, don't interfere with the throw
        logger.trackEvent('Failed to deserialize StorageItem', { key });
        throw e;
      }
    }
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
