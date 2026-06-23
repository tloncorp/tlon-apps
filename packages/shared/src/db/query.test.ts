import { QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setupDb } from '../test/helpers';
import { client } from './client';
import { QueryCtx, createWriteQuery, withTransactionCtx } from './query';
import { queryClient } from './reactQuery';

describe('withTransactionCtx', () => {
  let testCtx: QueryCtx;

  beforeEach(() => {
    testCtx = {
      db: client,
      pendingEffects: new Set(),
      meta: {
        label: 'test-transaction',
        tableEffects: [],
        tableDependencies: [],
      },
    };
  });

  // Test that running a transaction before setupDb doesn't permanently break transactions
  it('should throw error before setupDb and succeed after setupDb', async () => {
    const uninitializedCtx: QueryCtx = {
      db: client, // This will throw when accessed since db is not yet set up
      pendingEffects: new Set(),
      meta: {
        label: 'test-transaction-uninitialized',
        tableEffects: [],
        tableDependencies: [],
      },
    };

    // Step 1: Attempt to run transaction before setupDb (should throw)
    await expect(async () => {
      await withTransactionCtx(uninitializedCtx, async (_tx) => {
        return 'should not reach here';
      });
    }).rejects.toThrow('Database not set.');

    // Step 2: Call setupDb (actual initialization)
    setupDb();

    // Step 3: Attempt to run transaction after setupDb (should succeed)
    const workingCtx: QueryCtx = {
      db: client,
      pendingEffects: new Set(),
      meta: {
        label: 'test-transaction-working',
        tableEffects: [],
        tableDependencies: [],
      },
    };

    const result = await withTransactionCtx(workingCtx, async (_tx) => {
      return 'transaction successful';
    });

    expect(result).toBe('transaction successful');
  });

  it('should handle nested transactions correctly', async () => {
    // Test that nested transactions work properly
    const result = await withTransactionCtx(testCtx, async (outerTx) => {
      // This should run in the same transaction context
      return await withTransactionCtx(outerTx, async (innerTx) => {
        expect(innerTx.rootTransaction).toBe('test-transaction');
        return 'nested transaction successful';
      });
    });

    expect(result).toBe('nested transaction successful');
  });
});

describe('query invalidation', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('invalidates table-dependent queries that are already fetching', async () => {
    const queryKey = ['currentChats', new Set(['posts'])];
    let calls = 0;
    let resolveFetch!: () => void;
    const fetchGate = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });

    queryClient.setQueryData(queryKey, 'cached');

    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => {
        calls++;
        await fetchGate;
        return `fresh-${calls}`;
      },
    });

    const unsubscribe = observer.subscribe(() => {});
    const refetch = observer.refetch({ cancelRefetch: false });
    await Promise.resolve();

    const query = queryClient.getQueryCache().find({ queryKey });
    expect(query?.state.fetchStatus).toBe('fetching');
    expect(query?.isStale()).toBe(false);

    const writePosts = createWriteQuery(
      'testWritePosts',
      async (_ctx: QueryCtx) => {},
      ['posts']
    );

    await writePosts();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(query?.state.isInvalidated).toBe(true);
    expect(query?.isStale()).toBe(true);
    expect(calls).toBe(2);

    resolveFetch();
    await refetch;
    unsubscribe();
  });
});
