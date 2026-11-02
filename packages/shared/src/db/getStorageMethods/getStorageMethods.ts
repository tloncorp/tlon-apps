import AsyncStorage from '@react-native-async-storage/async-storage';

import { GetStorageMethods, StorageMethods } from './types';

class IndexedDbKeyValueStorage<V> implements StorageMethods<V> {
  constructor(private getStore: () => IDBObjectStore) {}

  async getItem(key: string): Promise<V | null> {
    const store = this.getStore();
    return awaitRequest(store.get(key));
  }

  async setItem(key: string, value: V): Promise<void> {
    const store = this.getStore();
    await awaitRequest(store.put(value, key));
  }

  async removeItem(key: string): Promise<void> {
    const store = this.getStore();
    await awaitRequest(store.delete(key));
  }
}

function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * If you have a `StorageMethods` implementation that requires async
 * initialization, you can use this class to synchronously construct a
 * `StorageMethods` object that "moves" the async down to its methods.
 */
class AwaitImplementationStorage<V> implements StorageMethods<V> {
  constructor(private basePromise: Promise<StorageMethods<V>>) {}

  async getItem(key: string): Promise<V | null> {
    const m = await this.basePromise;
    return await m.getItem(key);
  }
  async setItem(key: string, value: V): Promise<void> {
    const m = await this.basePromise;
    return await m.setItem(key, value);
  }
  async removeItem(key: string): Promise<void> {
    const m = await this.basePromise;
    return await m.removeItem(key);
  }
}

const indexedDbName = 'keyValueStorage';
const indexedDbStoreName = 'keyValueStorage';
const indexedDbGetStore: Promise<() => IDBObjectStore> | null =
  globalThis?.indexedDB == null
    ? null
    : (async () => {
        const dbOpenReq = globalThis.indexedDB.open(indexedDbName, 1);
        dbOpenReq.onupgradeneeded = async () => {
          const db = dbOpenReq.result;
          const s = db.createObjectStore(indexedDbStoreName);
          await new Promise((resolve, reject) => {
            s.transaction.oncomplete = resolve;
            s.transaction.onerror = reject;
          });
        };
        const db = await awaitRequest(dbOpenReq);

        return () => {
          const tx = db.transaction(indexedDbStoreName, 'readwrite');
          return tx.objectStore(indexedDbStoreName);
        };
      })();

function createIndexedDbStorage<V>() {
  return indexedDbGetStore == null
    ? null
    : new AwaitImplementationStorage<V>(
        indexedDbGetStore.then(
          (getStore) => new IndexedDbKeyValueStorage<V>(getStore)
        )
      );
}

const indexedDbStorage = createIndexedDbStorage<string>();

/**
 * The same IndexedDB store as `isLarge` storage items, holding values by
 * structured clone, so large binary values skip string serialization on the
 * main thread. Strings are values written by a string-serialized item.
 */
export const largeBinaryStorage = createIndexedDbStorage<
  ArrayBuffer | string
>();

export const getStorageMethods: GetStorageMethods = (config) => {
  if (config.isLarge) {
    return indexedDbStorage ?? AsyncStorage;
  }
  return AsyncStorage;
};
