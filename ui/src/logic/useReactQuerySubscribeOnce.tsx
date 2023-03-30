import { useSubscriptionState } from '@/api';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

export default function useReactQuerySubscribeOnce<T>({
  queryKey,
  app,
  path,
  options,
}: {
  queryKey: string[];
  app: string;
  path: string;
  options?: Omit<
    UseQueryOptions<T, unknown, T>,
    'queryKey' | 'queryFn' | 'initialData'
  >;
}): ReturnType<typeof useQuery> {
  const fetchData = async () =>
    new Promise<T>((resolve) => {
      useSubscriptionState.getState().subscribe({
        app,
        path,
        event: resolve,
      });
    });

  return useQuery(queryKey, fetchData, options);
}
