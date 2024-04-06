import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      // because of urbit's single threaded nature, we don't want to retry mutations since it might just be busy
      retry: false,
    },
  },
});

export default queryClient;
