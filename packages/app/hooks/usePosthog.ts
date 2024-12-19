import { usePostHog as useWebPosthog } from 'posthog-js/react';
import { useMemo } from 'react';

export function usePosthog() {
  const posthog = useWebPosthog();
  return useMemo(() => {
    return {
      optedOut: posthog?.has_opted_out_capturing() ?? false,
      optIn: posthog?.opt_in_capturing,
      identify: posthog?.identify,
      capture: posthog?.capture,
      flush: () => {
        // TODO: how to send await all pending events sent?
      },
      reset: posthog?.reset,
    };
  }, [posthog]);
}
