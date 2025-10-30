import AsyncStorage from '@react-native-async-storage/async-storage';

import { GetStorageMethods, StorageMethods } from './types';

class IndexedDbKeyValueStorage implements StorageMethods {
  constructor(private getStore: () => IDBObjectStore) {}

  async getItem(key: string): Promise<string | null> {
    const store = this.getStore();
    return awaitRequest(store.get(key));
  }

  async setItem(key: string, value: string): Promise<void> {
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
class AwaitImplementationStorage implements StorageMethods {
  constructor(private basePromise: Promise<StorageMethods>) {}

  async getItem(key: string): Promise<string | null> {
    const m = await this.basePromise;
    return await m.getItem(key);
  }
  async setItem(key: string, value: string): Promise<void> {
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
const indexedDbStorage = new AwaitImplementationStorage(
  (async () => {
    const dbOpenReq = indexedDB.open(indexedDbName);
    dbOpenReq.onupgradeneeded = async () => {
      const db = dbOpenReq.result;
      const s = db.createObjectStore(indexedDbStoreName);
      await new Promise((resolve, reject) => {
        s.transaction.oncomplete = resolve;
        s.transaction.onerror = reject;
      });
    };
    const db = await awaitRequest(dbOpenReq);

    return new IndexedDbKeyValueStorage(() => {
      const tx = db.transaction(indexedDbStoreName, 'readwrite');
      return tx.objectStore(indexedDbStoreName);
    });
  })()
);
export const getStorageMethods: GetStorageMethods = (config) =>
  config.isLarge ? indexedDbStorage : AsyncStorage;
