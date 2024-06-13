import { sql } from 'drizzle-orm';

import { queryClient } from '../api';
import { createDevLogger, escapeLog, listDebugLabel } from '../debug';
import * as changeListener from './changeListener';
import { AnySqliteDatabase, AnySqliteTransaction, client } from './client';
import { TableName } from './types';

const logger = createDevLogger('query', true);

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
    return withCtxOrDefault(meta, ctxArg, async (resolvedCtx) => {
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
  const result = await queryFn({ meta, pendingEffects, db: client });

  // Invalidate queries based on affected tables. We run in the next tick to
  // prevent possible loops.
  setTimeout(() => {
    changeListener.flush();
    if (!pendingEffects.size) {
      return;
    }
    logger.log(`${meta.label}:trigger:${listDebugLabel(pendingEffects)}`);
    queryClient.invalidateQueries({
      fetchStatus: 'idle',
      predicate: (query) => {
        const tableKey = query.queryKey[1];
        const shouldInvalidate =
          tableKey instanceof Set && setsOverlap(tableKey, pendingEffects);
        if (shouldInvalidate) {
          logger.log(`${meta.label}:invalidate:${escapeLog(query.queryHash)}`);
        }
        return shouldInvalidate;
      },
    });
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

/**
 * Creates a new context that will run operations against a transaction.
 * Executes the handler directly if already in a transaction.
 */
export async function withTransactionCtx<T>(
  ctx: QueryCtx,
  handler: (ctx: QueryCtx) => Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) =>
    enqueueTransaction(async () => {
      logger.log(ctx.meta.label, 'tx:handler');
      try {
        await ctx.db.run(sql`BEGIN`);
        logger.log(ctx.meta.label, 'tx:begin');

        const result = await handler(ctx);
        logger.log(ctx.meta.label, 'tx:run');

        await ctx.db.run(sql`COMMIT`);
        resolve(result);
        logger.log(ctx.meta.label, 'tx:commit');
        return result;
      } catch (e) {
        logger.log('tx:error', e);
        reject(e);
        await ctx.db.run(sql`ROLLBACK`);
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
