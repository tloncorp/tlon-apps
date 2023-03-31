import { useSubscriptionState } from '@/api';
import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';

export default function useReactQuerySubscribeOnce<T>({
  queryKey,
  app,
  path,
  options,
  enabled = true,
  initialData,
}: {
  queryKey: QueryKey;
  app: string;
  path: string;
  options?: UseQueryOptions;
  enabled?: boolean;
  initialData?: any;
}): ReturnType<typeof useQuery> {
  const fetchData = async () =>
    new Promise<T>((resolve) => {
      useSubscriptionState.getState().subscribe({
        app,
        path,
        event: resolve,
      });
    });

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
