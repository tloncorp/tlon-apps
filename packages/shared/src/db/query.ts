import { useCallback, useEffect, useState } from 'react';

import { TableName } from './types';

export type TableEventListener = (names: TableName[]) => void;

const tableEvents = {
  listeners: {} as Record<string, Set<TableEventListener>>,
  on(names: TableName[], listener: TableEventListener) {
    for (let name of names) {
      this.listeners[name] ||= new Set();
      this.listeners[name].add(listener);
    }
  },
  off(names: TableName[], listener: TableEventListener) {
    for (let name of names) {
      this.listeners[name]?.delete(listener);
    }
  },
  trigger(names: TableName[]) {
    // Filter and de-duplicate listeners
    const listeners = new Set(...names.map((n) => this.listeners[n]));
    for (let listener of listeners) {
      listener(names);
    }
  },
};

export interface QueryMeta {
  /**
   * Used to label logs.
   */
  label?: string;
  /**
   * Tables which should be considered changed after this query is executed.
   */
  tableEffects?: TableName[];
  /**
   * Tables where changes cause this query to become stale. (If it's a live
   * query, changes to these tables should trigger a re-fetch)
   */
  tableDependencies?: TableName[];
}

export interface WrappedQuery<Args extends any[], T> {
  (...args: Args): Promise<T>;
  meta: QueryMeta;
}

export const createQuery = <Args extends any[], T>(
  queryFn: (...args: Args) => Promise<T>,
  meta: QueryMeta = {}
): WrappedQuery<Args, T> => {
  // Wrap query function to trigger table events
  const wrappedQuery = async (...args: Args) => {
    const result = await queryFn(...args);
    // Trigger table effects if necessary.
    if (meta.tableEffects?.length) {
      tableEvents.trigger(meta.tableEffects);
    }
    return result;
  };

  return Object.assign(wrappedQuery, {
    meta,
  });
};

// Creates a hook that runs a query, rerunning it whenever deps change.
export const createUseQuery =
  <Args extends any[], T>(query: WrappedQuery<Args, T>) =>
  (...args: Args) => {
    const [result, setResult] = useState<T | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const runQuery = useCallback(async () => {
      console.log('refetching');
      query(...args)
        .then((result) => {
          setResult(result);
        })
        .catch((error) => {
          setError(error);
        });
    }, [...args]);

    // Run query on mount
    useEffect(() => {
      runQuery();
    }, []);

    // Run query when table dependencies change
    useEffect(() => {
      tableEvents.on(query.meta.tableDependencies ?? [], runQuery);
      return () => {
        tableEvents.off(query.meta.tableDependencies ?? [], runQuery);
      };
    }, [query]);
    return { result, error };
  };
