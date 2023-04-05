import api, { useSubscriptionState } from '@/api';
import useSchedulerStore from '@/state/scheduler';
import {
  QueryKey,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from '@tanstack/react-query';

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

  const fetchData = async () => {
    const scryData = await useSchedulerStore.getState().wait(
      async () =>
        api.scry({
          app: scryApp,
          path: initialScryPath,
        }),
      priority
    );

    useSchedulerStore.getState().wait(
      () =>
        useSubscriptionState.getState().subscribe({
          app,
          path,
          event: () => {
            queryClient.invalidateQueries(queryKey);
          },
        }),
      4
    );

    return scryData;
  };

  const defaultOptions = {
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled,
    initialData,
  };

  return useQuery(queryKey, fetchData, {
    ...defaultOptions,
    ...options,
  });
}
