import api from '@/api';
import { QueryKey, useQuery, UseQueryOptions } from '@tanstack/react-query';

export default function useReactQuerySubscribeOnce<T>({
  queryKey,
  app,
  path,
  options,
  initialData,
  timeout = 5000,
}: {
  queryKey: QueryKey;
  app: string;
  path: string;
  options?: UseQueryOptions;
  initialData?: any;
  timeout?: number;
}): ReturnType<typeof useQuery> {
  const fetchData = async () => api.subscribeOnce<T>(app, path, timeout);

  const defaultOptions = {
    retryOnMount: false,
    refetchOnMount: false,
    enabled: true,
    initialData,
  };
  return useQuery(queryKey, fetchData, {
    ...defaultOptions,
    ...options,
  });
}
