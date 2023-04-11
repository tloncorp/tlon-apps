import { get, set, del, keys as idbKeys } from 'idb-keyval';
import {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client';
import { version as appVersion } from '../package.json';

/**
 * Creates an Indexed DB persister
 * @see https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
 */
export default function createIDBPersister(
  idbValidKey: IDBValidKey = window.our
) {
  return {
    persistClient: async (client: PersistedClient) => {
      const promises = Object.entries(client.clientState.queries).map(
        ([key, data]) => set(`${idbValidKey}-${key}`, data)
      );

      await Promise.all(promises);
    },
    restoreClient: async () => {
      const client: PersistedClient = {
        clientState: { queries: [], mutations: [] },
        timestamp: Date.now(),
        // this is used to invalidate the cache when the app version changes
        buster: appVersion,
      };
      const keys = await idbKeys();

      const promises = keys
        .filter((key) => key.toString().startsWith(idbValidKey.toString()))
        .map(async (key) => {
          const queryData = await get(key);

          client.clientState.queries.push(queryData);
        });

      await Promise.all(promises);
      return client;
    },
    removeClient: async () => {
      const keys = await idbKeys();

      const promises = keys
        .filter((key) => key.toString().startsWith(idbValidKey.toString()))
        .map((key) => del(key));

      await Promise.all(promises);
    },
  } as Persister;
}
