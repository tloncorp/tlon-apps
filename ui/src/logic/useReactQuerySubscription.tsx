import api, { useSubscriptionState } from '@/api';
import {
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
  options,
}: {
  queryKey: string[];
  app: string;
  path: string;
  initialScryPath: string;
  scryApp?: string;
  options?: Omit<UseQueryOptions, 'queryKey' | 'queryFn' | 'initialData'>;
}): ReturnType<typeof useQuery> {
  const queryClient = useQueryClient();

  const fetchData = async () => {
    const initialData = await api.scry({
      app: scryApp,
      path: initialScryPath,
    });

    useSubscriptionState.getState().subscribe({
      app,
      path,
      event: () => {
        queryClient.invalidateQueries(queryKey);
      },
    });

    return initialData;
  };

  return useQuery(queryKey, fetchData, options);
}
