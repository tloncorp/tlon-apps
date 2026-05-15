import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

// Debug helper: expose queryClient and a cache summarizer on window for
// devtools inspection. Safe in production — read-only and guarded.
try {
  if (typeof globalThis !== 'undefined') {
    const g: any = globalThis;
    g.__tlonQueryClient = queryClient;
    g.__tlonInspectQueries = (opts?: {
      group?: 'firstKey' | 'tables' | 'full';
      top?: number;
    }) => {
      const group = opts?.group ?? 'firstKey';
      const top = opts?.top ?? 30;
      const queries = queryClient.getQueryCache().getAll();
      const bucket = new Map<
        string,
        { count: number; observers: number; stale: number; fetching: number }
      >();
      for (const q of queries) {
        let key: string;
        if (group === 'firstKey') {
          key = String(q.queryKey[0] ?? '<none>');
        } else if (group === 'tables') {
          const t = q.queryKey[1];
          key =
            t instanceof Set
              ? Array.from(t).sort().join(',')
              : String(t ?? '<none>');
        } else {
          key = q.queryHash;
        }
        const entry = bucket.get(key) ?? {
          count: 0,
          observers: 0,
          stale: 0,
          fetching: 0,
        };
        entry.count++;
        entry.observers += q.getObserversCount();
        if (q.isStale()) entry.stale++;
        if (q.state.fetchStatus === 'fetching') entry.fetching++;
        bucket.set(key, entry);
      }
      const rows = Array.from(bucket.entries())
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, top);
      // eslint-disable-next-line no-console
      console.table(rows);
      // eslint-disable-next-line no-console
      console.log(`total queries: ${queries.length}`);
      return rows;
    };
  }
} catch {
  // ignore
}

export { queryClient, QueryClientProvider };
