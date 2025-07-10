import { sql } from 'drizzle-orm';

import { queryClient } from '../api';
import { createDevLogger, escapeLog, listDebugLabel, runIfDev } from '../debug';
import { AnalyticsEvent } from '../domain';
import { startTrace } from '../perf';
import * as changeListener from './changeListener';
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

  /**
   * Used to indicate nested transaction context
   */
  rootTransaction?: string | null;
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
      try {
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
      } catch (e) {
        logger.trackEvent(AnalyticsEvent.ErrorDatabaseQuery, {
          label: meta.label,
          error: e,
          errorMessage: e.message,
          errorStack: e.stack,
        });
        throw e;
      }
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

async function runTransactions() {
  if (!isRunning) {
    isRunning = true;
    while (pendingTransactions.length) {
      const next = pendingTransactions.shift();
      if (!next) break;
      await next();
    }
    isRunning = false;
  }
}

const enqueueTransaction = async (fn: () => Promise<any>) => {
  pendingTransactions.push(fn);
  runTransactions();
};

const txLogger = createDevLogger('tx', false);

/**
 * Creates a new context that will run operations against a transaction.
 * Executes the handler directly if already in a transaction.
 */
export async function withTransactionCtx<T>(
  ctx: QueryCtx,
  handler: (ctx: QueryCtx) => Promise<T>
): Promise<T> {
  txLogger.log(ctx.meta.label, 'tx:enqueue');

  // If we're already in a transaction, run the handler directly
  if (ctx.meta.rootTransaction) {
    txLogger.log(ctx.meta.label, 'tx:already-in');
    try {
      txLogger.trackEvent('running nested transaction', {
        isNested: true,
        rootTransactionLabel: ctx.meta.rootTransaction,
        label: ctx.meta.label,
      });
      const result = await handler(ctx);
      txLogger.log(ctx.meta.label, 'tx:run');
      return result;
    } catch (e) {
      txLogger.log(ctx.meta.label, 'tx:error', e);
      txLogger.trackError('transaction error', {
        isNested: true,
        rootTransactionLabel: ctx.meta.rootTransaction,
        label: ctx.meta.label,
        errorMessage: e.message,
        errorStack: e.stack,
      });
      throw e;
    }
  }

  // Otherwise, start a new transaction
  return new Promise((resolve, reject) => {
    enqueueTransaction(async () => {
      txLogger.log(ctx.meta.label, 'tx:handler');

      try {
        await ctx.db.run(sql`BEGIN`);
        ctx.meta.rootTransaction = ctx.meta.label;
        txLogger.log(ctx.meta.label, 'tx:begin');

        const result = await handler(ctx);
        txLogger.log(ctx.meta.label, 'tx:run');

        await ctx.db.run(sql`COMMIT`);
        ctx.meta.rootTransaction = null;
        txLogger.log(ctx.meta.label, 'tx:commit');
        resolve(result);
        return result;
      } catch (e) {
        txLogger.log('tx:error', e);
        txLogger.trackError('DB Transaction Error', {
          label: ctx.meta.label,
          errorMessage: e.message,
          errorStack: e.stack,
        });
        await ctx.db.run(sql`ROLLBACK`).catch((e) =>
          txLogger.trackError('DB Transaction Rollback Error', {
            label: ctx.meta.label,
            errorMessage: e.message,
            errorStack: e.stack,
          })
        );
        ctx.meta.rootTransaction = null;
        reject(e);
      }
    });
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
