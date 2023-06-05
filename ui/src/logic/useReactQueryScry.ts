import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
import api from '@/api';
import useSchedulerStore from '@/state/scheduler';
import { useCallback } from 'react';

export default function useReactQueryScry({
  queryKey,
  app,
  path,
  priority = 3,
  options,
}: {
  queryKey: QueryKey;
  app: string;
  path: string;
  priority?: number;
  options?: UseQueryOptions;
}): ReturnType<typeof useQuery> {
  const fetchData = useCallback(
    async () =>
      useSchedulerStore.getState().wait(
        async () =>
          api.scry({
            app,
            path,
          }),
        priority
      ),
    [app, path, priority]
  );

  return useQuery(queryKey, fetchData, {
    retryOnMount: false,
    refetchOnMount: false,
    ...options,
  });
}
