import { usePostHog as useWebPosthog } from 'posthog-js/react';
import { useMemo } from 'react';

import { PosthogClient } from './usePosthog.base';

export function usePosthog() {
  const posthog = useWebPosthog();
  return useMemo((): PosthogClient => {
    return {
      optedOut: posthog?.has_opted_out_capturing() ?? false,
      optIn: () => {
        console.log('bl: Opting in to telemetry');
        posthog?.opt_in_capturing();
      },
      optOut: () => {
        console.log('bl: Opting out of telemetry');
        posthog?.opt_out_capturing();
      },
      identify: (userId, properties) => {
        console.log('bl: Identifying user', { userId, properties });
        posthog?.identify(userId, properties);
      },
      capture: (eventName, properties) =>
        posthog?.capture(eventName, properties),
      flush: async () => {
        // TODO: how to send await all pending events sent?
      },
      reset: () => posthog?.reset(),
    };
  }, [posthog]);
}
