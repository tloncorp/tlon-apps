import {
  getChannelUnreads,
  getContacts,
  getDMUnreads,
  getGroups,
  getPinnedItems,
} from './api';
import * as db from './db';
import { createDevLogger } from './debug';

// TODO: This is too complicated, clean up.

type Operation<T = unknown> = {
  load: () => Promise<T>;
  store: (params: T) => Promise<unknown>;
};

type OperationMap<T> = {
  [K in keyof T]: T[K] extends Operation<infer V> ? Operation<V> : never;
};

function makeOperations<T extends { [K: string]: Operation<any> }>(
  input: T
): OperationMap<T> {
  return input as unknown as OperationMap<T>;
}

const operations = makeOperations({
  contacts: {
    load: getContacts,
    store: db.insertContacts,
  },
  unreads: {
    load: async () => {
      const [channelUnreads, dmUnreads] = await Promise.all([
        getChannelUnreads(),
        getDMUnreads(),
      ]);
      return [...channelUnreads, ...dmUnreads];
    },
    store: db.insertUnreads,
  },
  groups: {
    load: getGroups,
    store: db.insertGroups,
  },
  pinnedItems: {
    load: getPinnedItems,
    store: db.insertPinnedItems,
  },
});

type OperationName = keyof typeof operations;

const logger = createDevLogger('sync', true);

export const syncGroups = () => runOperation('groups');
export const syncContacts = () => runOperation('contacts');
export const syncUnreads = () => runOperation('unreads');
export const syncPinnedItems = () => runOperation('pinnedItems');

export const syncAll = async () =>
  measureDuration('initial sync', async () => {
    const enabledOperations: OperationName[] = [
      'contacts',
      'groups',
      'pinnedItems',
      'unreads',
    ];
    for (const name of enabledOperations) {
      try {
        await runOperation(name);
      } catch (e) {
        console.log(e);
      }
    }
  });

async function runOperation(name: OperationName) {
  const startTime = Date.now();
  logger.log('starting', name);
  const operation = operations[name] as Operation;
  const result = await operation.load();
  const loadTime = Date.now() - startTime;
  await operation.store(result);
  const storeTime = Date.now() - startTime - loadTime;
  logger.log(
    'synced',
    name,
    'in',
    loadTime + 'ms (load) +',
    storeTime + 'ms (store)'
  );
}

async function measureDuration<T>(label: string, fn: () => Promise<T>) {
  const startTime = Date.now();
  try {
    return await fn();
  } catch (e) {
    logger.warn(label, 'failed', e, fn);
  } finally {
    logger.log(label, 'finished in', Date.now() - startTime, 'ms');
  }
}
