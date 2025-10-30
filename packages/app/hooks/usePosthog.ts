import { usePostHog as useWebPosthog } from 'posthog-js/react';
import { useMemo } from 'react';

import { PosthogClient } from './usePosthog.base';

export function usePosthog() {
  const posthog = useWebPosthog();
  return useMemo((): PosthogClient => {
    return {
      // since the function returns undefined if posthog is blocked or not available, we default to true
      getIsOptedOut: () => posthog?.has_opted_out_capturing() ?? true,
      optIn: () => {
        posthog?.opt_in_capturing();
      },
      optOut: () => {
        posthog?.opt_out_capturing();
      },
      identify: (userId, properties) => {
        posthog?.identify(userId, properties);
      },
      capture: (eventName, properties) =>
        posthog?.capture(eventName, properties),
      flush: async () => {
        // TODO: how to send await all pending events sent?
      },
      reset: () => posthog?.reset(),
      distinctId: () => {
        return posthog?.get_distinct_id();
      },
    };
  }, [posthog]);
}
