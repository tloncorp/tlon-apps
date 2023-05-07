import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: Infinity,
      refetchOnWindowFocus: !import.meta.env.DEV,
    },
  },
});

export default queryClient;
