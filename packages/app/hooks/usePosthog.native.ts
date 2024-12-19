import { usePostHog as useNativePosthog } from 'posthog-react-native';
import { useMemo } from 'react';

export function usePosthog() {
  const posthog = useNativePosthog();

  return useMemo(() => {
    return {
      optedOut: posthog?.optedOut ?? false,
      optIn: posthog?.optIn,
      optOut: posthog?.optOut,
      identify: posthog?.identify,
      capture: posthog?.capture,
      flush: posthog?.flush,
      reset: posthog?.reset,
    };
  }, [posthog]);
}
