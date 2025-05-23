import { usePostHog } from 'posthog-js/react';
import { PropsWithChildren, useEffect } from 'react';

import { ENABLED_LOGGERS } from '../constants';

export function TelemetryProvider({ children }: PropsWithChildren) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      if (ENABLED_LOGGERS.includes('posthog')) {
        posthog.debug();
      }
    }
  }, [posthog]);

  return <>{children}</>;
}
