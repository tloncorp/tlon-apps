import { usePostHog as useWebPosthog } from 'posthog-js/react';
import { useCallback, useMemo } from 'react';

export function usePosthog() {
  const posthog = useWebPosthog();

  const optedOut = useMemo(() => {
    return posthog?.has_opted_in_capturing() ?? false;
  }, [posthog]);

  const optIn = useCallback(() => {
    return posthog?.opt_in_capturing();
  }, [posthog]);

  const optOut = useCallback(() => {
    return posthog?.opt_out_capturing();
  }, [posthog]);

  const identify = useCallback(
    (userId: string, properties?: Record<string, any>) => {
      return posthog?.identify(userId, properties);
    },
    [posthog]
  );

  const capture = useCallback(
    (eventName: string, properties?: Record<string, any>) => {
      return posthog?.capture(eventName, properties);
    },
    [posthog]
  );

  const flush = useCallback(async () => {
    // TODO: how to send await all pending events sent?
  }, []);

  const reset = useCallback(() => {
    return posthog?.reset();
  }, [posthog]);

  return {
    optedOut,
    optIn,
    optOut,
    identify,
    capture,
    flush,
    reset,
  };
}
