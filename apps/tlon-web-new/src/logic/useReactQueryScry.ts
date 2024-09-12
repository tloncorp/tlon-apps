import { QueryKey, UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import api from '@/api';
import useSchedulerStore from '@/state/scheduler';

export default function useReactQueryScry<T>({
  queryKey,
  app,
  path,
  onScry,
  priority = 3,
  options,
}: {
  queryKey: QueryKey;
  app: string;
  path: string;
  onScry?: (data: T) => T;
  priority?: number;
  options?: UseQueryOptions<T>;
}) {
  const fetchData = useCallback(
    async () =>
      useSchedulerStore.getState().wait(async () => {
        const result = await api.scry<T>({
          app,
          path,
        });

        return onScry ? onScry(result) : result;
      }, priority),
    [app, path, priority]
  );

  return useQuery<T>(queryKey, fetchData, {
    retryOnMount: false,
    refetchOnMount: false,
    ...options,
  });
}
