import { is } from 'drizzle-orm';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';

import { queryClient } from '../api';
import { createDevLogger, escapeLog, listDebugLabel } from '../debug';
import { AnySqliteDatabase, AnySqliteTransaction, client } from './client';
import { TableName } from './types';

const logger = createDevLogger('query', false);

export interface QueryMeta<TOptions> {
  /**
   * Used to label logs.
   */
  label?: string;
  /**
   * Tables which should be considered changed after this query is executed.
   */
  tableEffects: TableParam<TOptions>;
  /**
   * Tables where changes cause this query to become stale. (If it's a live
   * query, changes to these tables should trigger a re-fetch)
   */
  tableDependencies: TableParam<TOptions>;
}

export interface QueryCtx {
  db: AnySqliteTransaction | AnySqliteDatabase;
  pendingEffects: Set<TableName>;
}

export type WrappedQuery<TOptions, TReturn> = (TOptions extends QueryCtx
  ? (ctx?: QueryCtx) => Promise<TReturn>
  : (options: TOptions, ctx?: QueryCtx) => Promise<TReturn>) & {
  meta: QueryMeta<TOptions>;
};

type QueryFn<TOptions, TReturn> = TOptions extends QueryCtx
  ? (ctx: QueryCtx) => Promise<TReturn>
  : (options: TOptions, ctx: QueryCtx) => Promise<TReturn>;

type TableParam<TOptions> =
  | TableName[]
  | (TOptions extends QueryCtx
      ? () => TableName[]
      : (options: TOptions) => TableName[]);

export const createReadQuery = <TOptions, TReturn>(
  label: string,
  queryFn: QueryFn<TOptions, TReturn>,
  tableDependencies: TableParam<TOptions>
): WrappedQuery<TOptions, TReturn> => {
  return createQuery<TOptions, TReturn>(queryFn, {
    label,
    tableEffects: [],
    tableDependencies,
  });
};

export const createWriteQuery = <TOptions, TReturn>(
  label: string,
  queryFn: QueryFn<TOptions, TReturn>,
  tableEffects: TableName[]
): WrappedQuery<TOptions, TReturn> => {
  return createQuery(queryFn, {
    label,
    tableEffects,
    tableDependencies: [],
  });
};

export const createQuery = <TOptions, TReturn>(
  queryFn: QueryFn<TOptions, TReturn>,
  meta: QueryMeta<TOptions>
): WrappedQuery<TOptions, TReturn> => {
  if (queryFn.length === 0) {
    console.warn(
      'invalid queryFn:',
      meta.label,
      'missing context arg. this can also be caused by query functions having default parameters.'
    );
  }
  // Wrap query function to trigger table events
  async function wrappedQuery(
    options?: TOptions,
    ctx?: QueryCtx
  ): Promise<TReturn> {
    const startTime = Date.now();
    logger.log(meta.label + ':start');
    // Resolve arguments based on parameter count of query function
    const [ctxArg, runQuery] = hasNoOptions(queryFn)
      ? [
          options as QueryCtx | undefined,
          (innerCtx: QueryCtx) => queryFn(innerCtx),
        ]
      : [
          ctx as QueryCtx | undefined,
          (innerCtx: QueryCtx) => queryFn(options as TOptions, innerCtx),
        ];
    // Run the query, ensuring that we have a context set.
    // Will kick off a transaction if this is a write query + there's no existing context.
    return withCtxOrDefault(
      meta.label ?? 'unknown',
      ctxArg,
      async (resolvedCtx) => {
        const result = await runQuery(resolvedCtx);
        logger.log(meta.label + ':end', Date.now() - startTime + 'ms');
        // Pass pending table effects to query context
        if (meta?.tableEffects) {
          const effects =
            typeof meta.tableEffects === 'function'
              ? meta.tableEffects(options!)
              : meta.tableEffects;
          if (effects.length) {
            logger.log(`${meta.label}:pending:[${effects.join(' ')}]`);
            effects.forEach((e) => resolvedCtx.pendingEffects.add(e));
          }
        }
        return result;
      }
    );
  }
  return Object.assign(wrappedQuery, {
    meta,
  }) as WrappedQuery<TOptions, TReturn>;
};

function hasNoOptions<TReturn>(
  fn: QueryFn<any, TReturn>
): fn is QueryFn<QueryCtx, TReturn> {
  return fn.length !== 2;
}

/**
 * Shorthand method to run a callback against a new write context.
 */
export async function batchEffects<T>(
  label: string,
  queryFn: (ctx: QueryCtx) => Promise<T>
) {
  return withCtxOrDefault(label, null, queryFn);
}

/**
 * Executes queryFn, ensuring ctx is set. Will use the supplied context, or
 * create one if missing.
 */
export async function withCtxOrDefault<T>(
  label: string,
  ctx: QueryCtx | null | undefined,
  queryFn: (ctx: QueryCtx) => T
) {
  // If called with a context, just execute the query directly
  if (ctx) {
    return queryFn(ctx);
  }

  // Run query, passing pendingEffects with context to collect effects.
  const pendingEffects = new Set<TableName>();
  const result = await queryFn({ pendingEffects, db: client });

  // Invalidate queries based on affected tables. We run in the next tick to
  // prevent possible loops.
  setTimeout(() => {
    if (!pendingEffects.size) {
      return;
    }
    logger.log(`${label}:trigger:${listDebugLabel(pendingEffects)}`);
    queryClient.invalidateQueries({
      predicate: (query) => {
        const tableKey = query.queryKey[1];
        const shouldInvalidate =
          tableKey instanceof Set && setsOverlap(tableKey, pendingEffects);
        if (shouldInvalidate) {
          logger.log(`${label}:invalidate:${escapeLog(query.queryHash)}`);
        }
        return shouldInvalidate;
      },
    });
  }, 0);
  return result;
}

/**
 * Creates a new context that will run operations against a transaction.
 * Executes the handler directly if already in a transaction.
 */
export function withTransactionCtx<T>(
  ctx: QueryCtx,
  handler: (ctx: QueryCtx) => Promise<T>
) {
  if (is(ctx.db, SQLiteTransaction)) {
    return handler(ctx);
  }
  return ctx.db.transaction((tx) => {
    return handler({ ...ctx, db: tx });
  });
}

function setsOverlap(setA: Set<unknown>, setB: Set<unknown>) {
  for (const v of setA) {
    if (setB.has(v)) {
      return true;
    }
  }
  return false;
}
