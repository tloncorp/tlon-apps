export interface Storage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => void;
}

let storageClient: Storage | null = null;

export function setStorage(storage: Storage) {
  storageClient = storage;
}

export const storage = new Proxy(
  {},
  {
    get: function (target, prop, receiver) {
      if (!storageClient) {
        throw new Error('storage client not configured');
      }
      return Reflect.get(storageClient, prop, receiver);
    },
  }
) as Storage;
