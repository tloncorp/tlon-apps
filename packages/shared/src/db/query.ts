import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createDevLogger } from '../debug';
import { TableName } from './types';

const logger = createDevLogger('query', false);
const tableEventsLogger = createDevLogger('tableEvents', false);

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
    tableEventsLogger.log('trigger', names);
    // Filter and de-duplicate listeners
    const listeners = new Set(...names.map((n) => this.listeners[n]));
    for (let listener of listeners) {
      listener(names);
    }
  },
};

export interface QueryMeta<Args extends any[]> {
  /**
   * Used to label logs.
   */
  label?: string;
  /**
   * Tables which should be considered changed after this query is executed.
   */
  tableEffects: TableParam<Args>;
  /**
   * Tables where changes cause this query to become stale. (If it's a live
   * query, changes to these tables should trigger a re-fetch)
   */
  tableDependencies: TableParam<Args>;
}

export interface WrappedQuery<Args extends any[], T> {
  (...args: Args): Promise<T>;
  meta: QueryMeta<Args>;
}

type TableParam<Args extends any[]> =
  | TableName[]
  | ((...args: Args) => TableName[]);

export const createReadQuery = <Args extends any[], T>(
  label: string,
  queryFn: (...args: Args) => Promise<T>,
  tableDependencies: TableParam<Args>
): WrappedQuery<Args, T> => {
  return createQuery(queryFn, {
    label,
    tableEffects: [],
    tableDependencies,
  });
};

export const createWriteQuery = <Args extends any[], T>(
  label: string,
  queryFn: (...args: Args) => Promise<T>,
  tableEffects: TableName[]
): WrappedQuery<Args, T> => {
  return createQuery(queryFn, {
    label,
    tableEffects,
    tableDependencies: [],
  });
};

export const createQuery = <Args extends any[], T>(
  queryFn: (...args: Args) => Promise<T>,
  meta: QueryMeta<Args>
): WrappedQuery<Args, T> => {
  // Wrap query function to trigger table events
  const wrappedQuery = async (...args: Args) => {
    const startTime = Date.now();
    logger.log(meta.label + ':', 'start');
    const result = await queryFn(...args);
    logger.log(meta.label + ':', Date.now() - startTime + 'ms');
    // Trigger table effects if necessary.
    if (meta?.tableEffects?.length) {
      tableEvents.trigger(
        typeof meta.tableEffects === 'function'
          ? meta.tableEffects(...args)
          : meta.tableEffects
      );
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
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<T | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const currentParams = useShallowEachObjectMemo(args);
    const runQuery = useCallback(async () => {
      // TODO: This could cause missed updates if the query is run multiple
      // times in rapid succession, but ensures load state stays correct.
      if (isLoading) return;
      setIsLoading(true);
      query(...args)
        .then((result) => {
          setResult(result);
        })
        .catch((error) => {
          setError(error);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, [currentParams]);

    // Run query on mount
    useEffect(() => {
      runQuery();
    }, [currentParams]);

    const deps = useMemo(() => {
      return typeof query.meta.tableDependencies === 'function'
        ? query.meta.tableDependencies(...args)
        : query.meta.tableDependencies;
    }, [currentParams]);

    // Run query when table dependencies change
    useEffect(() => {
      tableEvents.on(deps, runQuery);
      return () => {
        tableEvents.off(deps, runQuery);
      };
    }, [currentParams]);
    return { result, error, isLoading };
  };

function useShallowEachObjectMemo<T>(objs: T[]) {
  const ref = useRef(objs);
  if (objs.some((obj, i) => !isShallowEqual(obj, ref.current[i]))) {
    ref.current = objs;
  }
  return ref.current;
}

function isShallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (let key in a) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
