import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      cacheTime: Infinity,
    },
  },
});

export default queryClient;
