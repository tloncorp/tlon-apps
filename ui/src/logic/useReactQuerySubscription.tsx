import api from '@/api';
import useSchedulerStore from '@/state/scheduler';
import {
  QueryKey,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';
import { useEffect } from 'react';

export default function useReactQuerySubscription({
  queryKey,
  app,
  path,
  initialScryPath,
  scryApp = app,
  enabled = true,
  initialData,
  priority = 3,
  options,
}: {
  queryKey: QueryKey;
  app: string;
  path: string;
  initialScryPath: string;
  scryApp?: string;
  enabled?: boolean;
  initialData?: any;
  priority?: number;
  options?: UseQueryOptions;
}): ReturnType<typeof useQuery> {
  const queryClient = useQueryClient();

  const fetchData = async () =>
    useSchedulerStore.getState().wait(
      async () =>
        api.scry({
          app: scryApp,
          path: initialScryPath,
        }),
      priority
    );

  useEffect(() => {
    api.subscribe({
      app,
      path,
      event: () => {
        queryClient.invalidateQueries(queryKey);
      },
    });
  }, [app, path, queryClient, queryKey]);

  return useQuery(queryKey, fetchData, {
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled,
    initialData,
    ...options,
  });
}
