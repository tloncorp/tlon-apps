import { sql } from 'drizzle-orm';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import { queryClient } from '../api';
import { createDevLogger, escapeLog, listDebugLabel } from '../debug';
import { startTrace } from '../perf';
import * as changeListener from './changeListener';
import {
  AnySqliteDatabase,
  AnySqliteTransaction,
  client,
  sqlocal,
} from './client';
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
  sqlocal?: SQLocalDrizzle;
  pendingEffects: Set<TableName>;
  meta: QueryMeta<any>;
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
    // No `awaits`!
    // The performance tracing API is necessarily promise-based since we're
    // talking to native code, but we don't want to block the query.
    const queryTracePromise =
      meta.label && startTrace(['query', meta.label].join('.'));
    const completeQueryTraceIfPossible = () => {
      if (queryTracePromise) {
        queryTracePromise.then(async (trace) => {
          await trace.stop();
        });
      }
    };

    const startTime = Date.now();
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
    return withCtxOrDefault(meta, ctxArg, async (resolvedCtx) => {
      const result = await runQuery(resolvedCtx);
      logger.log(meta.label + ':end', Date.now() - startTime + 'ms');
      completeQueryTraceIfPossible();
      // Pass pending table effects to query context
      if (meta?.tableEffects) {
        const effects =
          typeof meta.tableEffects === 'function'
            ? meta.tableEffects(options!)
            : meta.tableEffects;
        if (effects.length) {
          effects.forEach((e) => resolvedCtx.pendingEffects.add(e));
        }
      }
      return result;
    });
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
  return withCtxOrDefault(
    { label, tableDependencies: [], tableEffects: [] },
    null,
    queryFn
  );
}

/**
 * Executes queryFn, ensuring ctx is set. Will use the supplied context, or
 * create one if missing.
 */
export async function withCtxOrDefault<T>(
  meta: QueryMeta<any>,
  ctx: QueryCtx | null | undefined,
  queryFn: (ctx: QueryCtx) => T
) {
  // If called with a context, just execute the query directly
  if (ctx) {
    return queryFn(ctx);
  }

  // Run query, passing pendingEffects with context to collect effects.
  const pendingEffects = new Set<TableName>();
  const result = await queryFn({ meta, pendingEffects, db: client, sqlocal });

  // Invalidate queries based on affected tables. We run in the next tick to
  // prevent possible loops.
  setTimeout(() => {
    changeListener.flush();
    if (!pendingEffects.size) {
      return;
    }
    const invalidated: string[] = [];
    queryClient.invalidateQueries({
      fetchStatus: 'idle',
      predicate: (query) => {
        const tableKey = query.queryKey[1];
        const shouldInvalidate =
          tableKey instanceof Set && setsOverlap(tableKey, pendingEffects);
        if (shouldInvalidate) {
          invalidated.push(query.queryHash);
        }
        return shouldInvalidate;
      },
    });
    logger.log(
      `${meta.label}:triggered:${listDebugLabel(pendingEffects)}`,
      'invalidating',
      invalidated.map(escapeLog)
    );
  }, 0);
  return result;
}

const pendingTransactions: (() => Promise<any>)[] = [];
let isRunning = false;

const enqueueTransaction = async (fn: () => Promise<any>) => {
  pendingTransactions.push(fn);
  if (!isRunning) {
    isRunning = true;
    while (pendingTransactions.length) {
      const next = pendingTransactions.shift();
      if (!next) break;
      await next();
    }
    isRunning = false;
  }
};

const txLogger = createDevLogger('tx', false);

const createTransactionProxyDb = (ctx: QueryCtx, tx: any) => {
  function createQueryWrapper() {
    let currentQuery: any = null;

    // List of methods we want to proxy
    const methodsToProxy = new Set([
      'insert',
      'select',
      'update',
      'delete',
      'values',
      'onConflictDoUpdate',
      'onConflictDoNothing',
      'where',
      'orderBy',
      'limit',
      'offset',
      'from',
      'set',
      'setWhere',
      'returning',
    ]);

    const wrapper = new Proxy(
      {},
      {
        get(target, prop) {
          // Handle promise-like behavior
          if (prop === 'then' || prop === 'catch' || prop === 'finally') {
            txLogger.log('tx:proxy:executing:start');
            try {
              txLogger.log('tx:proxy:executing:getting-sql');
              const { sql, params } = currentQuery.toSQL();
              // Get selected fields map if this is a select query
              const selectedFields = currentQuery.getSelectedFields?.();

              const executeQuery = async () => {
                const rawResults = await tx.query({ sql, params });

                // If we have selected fields, transform the results
                if (selectedFields) {
                  return Array.isArray(rawResults)
                    ? rawResults.map((row) => {
                        const transformed: Record<string, any> = {};
                        for (const [alias, field] of Object.entries(
                          selectedFields
                        )) {
                          // Use the alias as the key instead of the column name
                          // (preserves the alias in the result)
                          transformed[alias] = row[(field as any).name];
                        }
                        return transformed;
                      })
                    : rawResults;
                }

                return rawResults;
              };

              const promise = executeQuery();
              return promise[prop].bind(promise);
            } catch (e) {
              txLogger.error('tx:proxy:executing:error', e);
              throw e;
            }
          }

          // Get the original method/property
          const originalValue = Reflect.get(currentQuery, prop);

          // If it's not a method we want to proxy, return it directly
          if (
            typeof originalValue === 'function' &&
            !methodsToProxy.has(String(prop))
          ) {
            return originalValue.bind(currentQuery);
          }

          // Handle query builder methods we want to proxy
          if (typeof originalValue === 'function') {
            return (...args: any[]) => {
              const result = originalValue.apply(currentQuery, args);
              currentQuery = result;
              return wrapper;
            };
          }

          return originalValue;
        },
      }
    );

    return {
      wrap(query: any) {
        currentQuery = query;
        return wrapper;
      },
    };
  }

  return new Proxy(ctx.db, {
    get(target, prop) {
      const original = Reflect.get(target, prop);

      // Handle the type-safe query API
      if (prop === 'query') {
        return new Proxy(original, {
          get(queryTarget, queryProp) {
            const queryOriginal = Reflect.get(queryTarget, queryProp);
            if (typeof queryOriginal === 'object' && queryOriginal !== null) {
              return new Proxy(queryOriginal, {
                get(tableTarget, tableProp) {
                  const tableMethod = Reflect.get(tableTarget, tableProp);
                  if (typeof tableMethod === 'function') {
                    return async (...args: any[]) => {
                      const queryBuilder = tableMethod.apply(tableTarget, args);
                      const { sql, params } = queryBuilder.toSQL();
                      return tx.query({ sql, params });
                    };
                  }
                  return tableMethod;
                },
              });
            }
            return queryOriginal;
          },
        });
      }

      if (typeof original === 'function') {
        return (...args: any[]) => {
          // For direct SQL operations
          if (prop === 'run' || prop === 'all' || prop === 'get') {
            return tx.query(args[0]);
          }

          // For query builders
          const queryBuilder = original.apply(target, args);
          const wrapper = createQueryWrapper();
          return wrapper.wrap(queryBuilder);
        };
      }

      return original;
    },
  }) as typeof ctx.db;
};

/**
 * Creates a new context that will run operations against a transaction.
 * Executes the handler directly if already in a transaction.
 */
export async function withTransactionCtx<T>(
  ctx: QueryCtx,
  handler: (ctx: QueryCtx) => Promise<T>
): Promise<T> {
  txLogger.log(ctx.meta.label, 'tx:enqueue');
  return new Promise((resolve, reject) =>
    enqueueTransaction(async () => {
      txLogger.log(ctx.meta.label, 'tx:handler');
      try {
        if (ctx.sqlocal?.transaction) {
          txLogger.log('beginning transaction, sqlocal', ctx.sqlocal);
          // Use the sqlocal transaction API. This is a bit more complex since
          // we need to proxy the query builder to handle the transaction.
          txLogger.log(ctx.meta.label, 'tx:sqlocal:before');
          const result = await ctx.sqlocal.transaction(async (tx) => {
            txLogger.log(ctx.meta.label, 'tx:sqlocal:transaction:start');

            const proxyDb = createTransactionProxyDb(ctx, tx);

            const txCtx = {
              ...ctx,
              db: proxyDb,
            };

            txLogger.log(ctx.meta.label, 'tx:sqlocal:before:handler');
            const handlerResult = await handler(txCtx);
            txLogger.log(ctx.meta.label, 'tx:sqlocal:after:handler', {
              hasResult: !!handlerResult,
            });
            return handlerResult;
          });

          txLogger.log(ctx.meta.label, 'tx:sqlocal:after:transaction', {
            hasResult: !!result,
          });

          resolve(result);
          return result;
        } else {
          txLogger.log('beginning transaction, native');
          await ctx.db.run(sql`BEGIN`);
          txLogger.log(ctx.meta.label, 'tx:begin');

          const result = await handler(ctx);
          txLogger.log(ctx.meta.label, 'tx:run');

          await ctx.db.run(sql`COMMIT`);
          resolve(result);
          txLogger.log(ctx.meta.label, 'tx:commit');
          return result;
        }
      } catch (e) {
        txLogger.log('tx:error', e);
        reject(e);
        if (!ctx.sqlocal) {
          // Rollback if we're not using sqlocal
          // (sqlocal handles this automatically)
          await ctx.db.run(sql`ROLLBACK`);
          txLogger.log(ctx.meta.label, 'tx:rollback');
        }
      }
    })
  );
}

function setsOverlap(setA: Set<unknown>, setB: Set<unknown>) {
  for (const v of setA) {
    if (setB.has(v)) {
      return true;
    }
  }
  return false;
}
