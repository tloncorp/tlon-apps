import { get, set, del } from 'idb-keyval';
import {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';

/**
 * Creates an Indexed DB persister
 * @see https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
 */
export default function createIDBPersister(
  idbValidKey: IDBValidKey = window.our
) {
  return {
    persistClient: async (client: PersistedClient) => {
      set(idbValidKey, client);
    },
    restoreClient: async () => get<PersistedClient>(idbValidKey),
    removeClient: async () => {
      await del(idbValidKey);
    },
  } as Persister;
}
