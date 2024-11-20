import { usePostHog as useNativePosthog } from 'posthog-react-native';
import { useCallback, useMemo } from 'react';

import { TelemetryClient } from '../types/telemetry';

export function useTelemetry(): TelemetryClient {
  const posthog = useNativePosthog();

  const optedOut = useMemo(() => {
    return posthog?.optedOut ?? false;
  }, [posthog]);

  const optIn = useCallback(() => {
    return posthog?.optIn();
  }, [posthog]);

  const optOut = useCallback(() => {
    return posthog?.optOut();
  }, [posthog]);

  const identify = useCallback(
    (userId: string, properties: Record<string, any>) => {
      return posthog?.identify(userId, properties);
    },
    [posthog]
  );

  const capture = useCallback(
    (eventName: string, properties?: Record<string, string>) => {
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
