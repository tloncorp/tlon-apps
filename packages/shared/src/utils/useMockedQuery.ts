import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

/**
 * A helper hook for testing components that use `useQuery`. It allows you
 * to mock the query function's response and trigger re-renders when the
 * response changes.
 *
 * After calling `setResponse` with a new promise, you must manually refetch
 * the query (e.g. by calling `query.refetch()`).
 *
 * `deferred.ts` works nicely with this.
 *
 * ```tsx
 * const [query, setResponse] = useMockedQuery({
 *   initial: async () => null,
 * });
 *
 * setResponse(Promise.resolve({ usedBytes: 500, totalBytes: 1000 }));
 * query.refetch();
 *
 * import { createDeferred } from './deferred';
 * const deferred = createDeferred()
 * setResponse(deferred.promise);
 * deferred.reject(new Error('Simulated error'));
 * ```
 */
export function useMockedQuery<Data>({
  initial,
  queryOptions,
}: {
  initial: () => Promise<Data>;
  queryOptions?: Partial<Parameters<typeof useQuery<Data>>[0]>;
}) {
  const [queryFnResult, setQueryFnResult] = useState(initial);
  const query = useQuery({
    queryKey: ['mocked-query'],
    async queryFn(): Promise<Data> {
      return queryFnResult;
    },
    retry: false,
    ...queryOptions,
  });

  const setResponse = useCallback((resp: Promise<Data>) => {
    setQueryFnResult(resp);
  }, []);

  return [query, setResponse] as const;
}
