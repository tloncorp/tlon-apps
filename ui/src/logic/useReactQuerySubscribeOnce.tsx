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
  const fetchData = async () => {
    let timeoutId: NodeJS.Timeout | undefined;
    let subscriptionId: number | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('subscribeOnce timed out'));
      }, timeout);
    });

    const subscriptionPromise = new Promise<T>((resolve) => {
      api
        .subscribe({
          app,
          path,
          event: (data) => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve(data);
          },
        })
        .then((id) => {
          subscriptionId = id;
        });
    });

    try {
      const result = await Promise.race([subscriptionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    } finally {
      if (subscriptionId !== undefined) {
        api.unsubscribe(subscriptionId);
      }
    }
  };

  const defaultOptions = {
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    enabled: true,
    initialData,
  };
  return useQuery(queryKey, fetchData, {
    ...defaultOptions,
    ...options,
  });
}
