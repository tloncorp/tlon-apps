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

class KeyRoutingStorage implements StorageMethods {
  #defaultStorage = AsyncStorage;
  #indexedDbStoragePromise: Promise<IndexedDbKeyValueStorage>;
  readonly #indexedDbName = 'keyValueStorage';
  readonly #indexedStoreName = 'keyValueStorage';

  constructor() {
    this.#indexedDbStoragePromise = (async () => {
      const dbOpenReq = indexedDB.open('keyValueStorage', 1);
      dbOpenReq.onupgradeneeded = async () => {
        const db = dbOpenReq.result;
        const s = db.createObjectStore('keyValueStore');
        await new Promise((resolve, reject) => {
          s.transaction.oncomplete = resolve;
          s.transaction.onerror = reject;
        });
      };
      const db = await awaitRequest(dbOpenReq);
      return new IndexedDbKeyValueStorage(() => {
        const tx = db.transaction(this.#indexedDbName, 'readwrite');
        return tx.objectStore(this.#indexedStoreName);
      });
    })();
  }

  async route(key: string): Promise<StorageMethods> {
    if (key === 'sqliteContent') {
      return await this.#indexedDbStoragePromise;
    }
    return this.#defaultStorage;
  }

  async getItem(key: string): Promise<string | null> {
    const m = await this.route(key);
    return await m.getItem(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    const m = await this.route(key);
    return await m.setItem(key, value);
  }
  async removeItem(key: string): Promise<void> {
    const m = await this.route(key);
    return await m.removeItem(key);
  }
}

const storage = new KeyRoutingStorage();
export const getStorageMethods: GetStorageMethods = (_config) => storage;
