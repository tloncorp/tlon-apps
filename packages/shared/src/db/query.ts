import { queryClient } from '../api';
import { createDevLogger } from '../debug';
import { TableName } from './types';

const logger = createDevLogger('query', false);

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
    logger.log(meta.label + ':start');
    const result = await queryFn(...args);
    logger.log(meta.label + ':end', Date.now() - startTime + 'ms');
    // Trigger table effects if necessary.
    if (meta?.tableEffects?.length) {
      const effects =
        typeof meta.tableEffects === 'function'
          ? meta.tableEffects(...args)
          : meta.tableEffects;
      logger.log((meta.label ?? '') + ':invalidating', ...effects);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const tableKey = query.queryKey[1];
          return (
            tableKey instanceof Set && effects.some((e) => tableKey.has(e))
          );
        },
      });
    }
    return result;
  };
  return Object.assign(wrappedQuery, {
    meta,
  });
};
