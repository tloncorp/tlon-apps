import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';
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
  const fetchData = async () =>
    useSchedulerStore.getState().wait(
      async () =>
        api.scry<T>({
          app,
          path,
        }),
      priority
    );

  return useQuery<T>(queryKey, fetchData, {
    retryOnMount: false,
    refetchOnMount: false,
    ...options,
  });
}
