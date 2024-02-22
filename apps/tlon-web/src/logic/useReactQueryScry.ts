import { QueryKey, UseQueryOptions, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import api from '@/api';
import useSchedulerStore from '@/state/scheduler';

export default function useReactQueryScry<T>({
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
  options?: UseQueryOptions<T>;
}) {
  const fetchData = useCallback(
    async () =>
      useSchedulerStore.getState().wait(
        async () =>
          api.scry<T>({
            app,
            path,
          }),
        priority
      ),
    [app, path, priority]
  );

  return useQuery<T>(queryKey, fetchData, {
    retryOnMount: false,
    refetchOnMount: false,
    ...options,
  });
}
